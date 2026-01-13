import express from 'express';
import { Client } from '@notionhq/client';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const notion = new Client({ auth: process.env.NOTION_TOKEN });
app.use(cors());
app.use(express.json());

const DB_CONFIG = process.env.DB_CONFIG;
const databases = {
  humanoid: process.env.DB_HUMANOID,
  quadruped: process.env.DB_QUADRUPED,
  vacuum: process.env.DB_VACUUM,
  pool_cleaner: process.env.DB_POOL_CLEANER,
  lawn_mower: process.env.DB_LAWN_MOWER,
  industrial: process.env.DB_INDUSTRIAL,
  wheeled: process.env.DB_WHEELED,
  companion: process.env.DB_COMPANION,
  drone: process.env.DB_DRONE,
  others: process.env.DB_OTHERS
};

  { id: 'humanoid', name: 'Humanoid', icon: '🤖' },
  { id: 'quadruped', name: 'Quadruped', icon: '🐕' },
  { id: 'vacuum', name: 'Vacuum', icon: '🧹' },
  { id: 'pool_cleaner', name: 'Pool Cleaner', icon: '🏊' },
  { id: 'lawn_mower', name: 'Lawn Mower', icon: '🌿' },
  { id: 'industrial', name: 'Industrial', icon: '🏭' },
  { id: 'wheeled', name: 'Wheeled', icon: '🦿' },
  { id: 'companion', name: 'Companion', icon: '🤗' },
  { id: 'drone', name: 'Drone', icon: '🚁' },
  { id: 'others', name: 'Others', icon: '📦' }
];

const configCache = {};
app.get('/api/categories', function(req, res) {
  res.json(categories);
});
app.get('/api/robots/:category', async function(req, res) {
  try {
    var cat = req.params.category;
    var dbId = databases[cat];
    if (!dbId) return res.status(404).json({ error: 'Not found' });
    var dbInfo = await notion.databases.retrieve({ database_id: dbId });
    var schema = dbInfo['properties'];
    var result = await notion.databases.query({ database_id: dbId, page_size: 100 });
    var hasKSP = Object.keys(schema).some(function(k) { return k.indexOf('KSP') === 0; });
    var props = [];
    var okTypes = ['title','rich_text','number','select','multi_select','checkbox','url'];
    for (var n in schema) {
      if (okTypes.indexOf(schema[n].type) >= 0) props.push({name: n, type: schema[n].type});
    }
    // 继续 Part B...
      var robots = [];
    var skip = ['Model','Company','Image','Name','Brand'];
    for (var i = 0; i < result.results.length; i++) {
      var pg = result.results[i];
      var p = pg['properties'];
      var specs = {}, ksp = [];
      for (var k in p) {
        var v = extractValue(p[k]);
        if (k.indexOf('KSP-') === 0) ksp[parseInt(k.replace('KSP-',''))-1] = v;
        else if (skip.indexOf(k) < 0) specs[k] = v;
      }
      robots.push({
        id: pg['id'],
        model: extractValue(p['Model']) || extractValue(p['Name']) || 'Unknown',
        company: extractValue(p['Company']) || extractValue(p['Brand']) || 'Unknown',
        image: extractValue(p['Image']),
        specs: specs,
        ksp: ksp.filter(function(x){return x;})
      });
    }
    res.json({ robots: robots, properties: props, hasKSP: hasKSP });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/config/:category', async function(req, res) {
  try {
    var cat = req.params.category;
    if (configCache[cat]) return res.json({ specGroups: configCache[cat] });
    if (DB_CONFIG) {
      var r = await notion.databases.query({
        database_id: DB_CONFIG,
        filter: { property: 'Category', rich_text: { equals: cat } }
      });
      if (r.results.length > 0) {
        var json = extractValue(r.results[0]['properties']['Config']);
        if (json) {
          configCache[cat] = JSON.parse(json);
          return res.json({ specGroups: configCache[cat] });
        }
      }
    }
    res.json({ specGroups: [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/config/:category', async function(req, res) {
  try {
    var cat = req.params.category;
    var sg = req.body.specGroups;
    configCache[cat] = sg;
    
    if (DB_CONFIG) {
      var r = await notion.databases.query({
        database_id: DB_CONFIG,
        filter: { property: 'Category', rich_text: { equals: cat } }
      });
      var json = JSON.stringify(sg);
      var txt = [{ text: { content: json.slice(0, 2000) } }];
      
      if (r.results.length > 0) {
        await notion.pages.update({
          page_id: r.results[0].id,
          properties: { Config: { rich_text: txt } }
        });
      } else {
        await notion.pages.create({
          parent: { database_id: DB_CONFIG },
          properties: {
            Category: { rich_text: [{ text: { content: cat } }] },
            Config: { rich_text: txt }
          }
        });
      }
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
function extractValue(prop) {
  if (!prop) return null;
  var t = prop.type;
  
  if (t === 'title') {
    return prop.title[0] ? prop.title[0].plain_text : null;
  }
  if (t === 'rich_text') {
    return prop.rich_text[0] ? prop.rich_text[0].plain_text : null;
  }
  if (t === 'number') {
    return prop.number;
  }
  if (t === 'select') {
    return prop.select ? prop.select.name : null;
  }
  if (t === 'multi_select') {
    return prop.multi_select.map(function(s) { return s.name; }).join(', ');
  }
  if (t === 'checkbox') {
    return prop.checkbox ? 'Yes' : 'No';
  }
  if (t === 'url') {
    return prop.url;
  }
  if (t === 'files' && prop.files[0]) {
    var f = prop.files[0];
    return f.file ? f.file.url : (f.external ? f.external.url : null);
  }
  if (t === 'formula') {
    return prop.formula.string || prop.formula.number;
  }
  
  return null;
}
var PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, function() {
    console.log('🚀 Server running on port', PORT);
  });
}

export default app;
