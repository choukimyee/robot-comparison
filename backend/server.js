const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');
require('dotenv').config();

const app = express();
const notion = new Client({ auth: process.env.NOTION_TOKEN });

app.use(cors());
app.use(express.json());

const DB_CONFIG = process.env.DB_CONFIG || '2e361bed8f1c80b7b408f9210a57ef58';

const databases = {
  humanoid: process.env.DB_HUMANOID || '5287fbe07a1f459f9641ef25da1d604b',
  quadruped: process.env.DB_QUADRUPED || 'c14806f5048b4a29b616d5ec93b3d53c',
  vacuum: process.env.DB_VACUUM || '9c845bdc3ec54ddfae1381eed85c480f',
  pool_cleaner: process.env.DB_POOL_CLEANER || '24a8ebb8167a4acfa7c555a3529cef90',
  lawn_mower: process.env.DB_LAWN_MOWER || '0797ce98f8464c7abe2c25644d43978b',
  industrial: process.env.DB_INDUSTRIAL || '2a4638597dd945e492adccd286da0615',
  wheeled: process.env.DB_WHEELED || '4009dbfc313949cc8900f70ffadc26a5',
  companion: process.env.DB_COMPANION || '9a3a7a3d3ee744e3905843ab967b4f27',
  drone: process.env.DB_DRONE || '0acb01e2fbeb494f9876c004aacbcb5a',
  others: process.env.DB_OTHERS || '925a0db1fd3e48a3b2a09e7d300ea8e5'
};

const categories = [
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

app.get('/api/categories', (req, res) => {
  console.log('📋 返回分类列表');
  res.json(categories);
});

app.get('/api/robots/:category', async (req, res) => {
  try {
    const { category } = req.params;
    console.log(`🤖 获取机器人数据: ${category}`);
    
    const databaseId = databases[category];
    if (!databaseId) {
      console.error(`❌ 分类不存在: ${category}`);
      return res.status(404).json({ error: 'Category not found' });
    }

    const dbResponse = await notion.databases.retrieve({ database_id: databaseId });
    const schema = dbResponse.properties;

    const properties = Object.keys(schema)
      .filter(key => !['Model', 'Company', 'Image'].includes(key) && !key.startsWith('KSP-'))
      .map(key => ({ name: key, type: schema[key].type }));

    const hasKSP = Object.keys(schema).some(key => key.startsWith('KSP-'));

    const queryResponse = await notion.databases.query({
      database_id: databaseId,
      sorts: [{ property: 'Company', direction: 'ascending' }]
    });

    const robots = queryResponse.results.map(page => {
      const props = page.properties;
      const robot = {
        id: page.id,
        model: props.Model?.title?.[0]?.plain_text || '',
        company: props.Company?.select?.name || '',
        image: props.Image?.files?.[0]?.file?.url || props.Image?.files?.[0]?.external?.url || null,
        specs: {},
        ksp: []
      };

      for (let i = 1; i <= 5; i++) {
        const kspKey = `KSP-${i}`;
        robot.ksp.push(props[kspKey]?.rich_text?.[0]?.plain_text || '');
      }

      Object.keys(schema).forEach(key => {
        if (key === 'Model' || key === 'Company' || key === 'Image' || key.startsWith('KSP-')) return;
        const prop = props[key];
        if (!prop) return;
        switch (schema[key].type) {
          case 'number': robot.specs[key] = prop.number; break;
          case 'select': robot.specs[key] = prop.select?.name || null; break;
          case 'rich_text':
          case 'text': robot.specs[key] = prop.rich_text?.[0]?.plain_text || null; break;
          case 'url': robot.specs[key] = prop.url || null; break;
        }
      });
      return robot;
    });

    console.log(`✅ 返回 ${robots.length} 个机器人`);
    res.json({ robots, properties, hasKSP });
  } catch (error) {
    console.error('❌ 获取机器人数据失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/config/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const response = await notion.databases.query({
      database_id: DB_CONFIG,
      filter: { property: 'Category', title: { equals: category } }
    });
    if (response.results.length > 0) {
      const configText = response.results[0].properties.Config?.rich_text?.[0]?.plain_text || '{}';
      return res.json(JSON.parse(configText));
    }
    res.json({ specGroups: [] });
  } catch (error) {
    res.json({ specGroups: [] });
  }
});

app.post('/api/config/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { specGroups } = req.body;
    const queryResponse = await notion.databases.query({
      database_id: DB_CONFIG,
      filter: { property: 'Category', title: { equals: category } }
    });
    const configText = JSON.stringify({ specGroups });
    if (queryResponse.results.length > 0) {
      await notion.pages.update({
        page_id: queryResponse.results[0].id,
        properties: { Config: { rich_text: [{ text: { content: configText } }] } }
      });
    } else {
      await notion.pages.create({
        parent: { database_id: DB_CONFIG },
        properties: {
          Category: { title: [{ text: { content: category } }] },
          Config: { rich_text: [{ text: { content: configText } }] }
        }
      });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
