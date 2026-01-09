import express from 'express';
import cors from 'cors';
import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
import { databases } from './config/databases.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

console.log('🔍 环境变量检查:');
console.log('TOKEN:', process.env.NOTION_TOKEN ? '✅ 已加载' : '❌ 未加载');
console.log('DB_HUMANOID:', process.env.DB_HUMANOID ? '✅ 已加载' : '❌ 未加载');
console.log('配置的数据库数量:', Object.values(databases).filter(db => db.id).length);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const notion = new Client({ auth: process.env.NOTION_TOKEN });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const cache = new Map();

// 获取分类列表
app.get('/api/categories', (req, res) => {
  const cats = Object.entries(databases).filter(([_,db])=>db.id).map(([id,db])=>({id,icon:db.icon,name:id,specGroups:db.specGroups}));
  console.log('📡 /api/categories 请求，返回', cats.length, '个品类');
  res.json(cats);
});

// 获取机器人数据 + 数据库 Schema
app.get('/api/robots/:category', async (req, res) => {
  try {
    const db = databases[req.params.category];
    if (!db || !db.id) return res.status(404).json({error:'Not found'});
    
    const cached = cache.get(req.params.category);
    if (cached && Date.now() - cached.time < 60000) {
      console.log('📦 使用缓存数据:', req.params.category);
      return res.json(cached.data);
    }

    console.log('🔄 从 Notion 获取数据:', req.params.category);
    
    // 获取数据库信息（包含 schema）
    const dbInfo = await notion.databases.retrieve({database_id: db.id});
    
    // 打印所有属性名以便调试
    console.log('📋 数据库属性:', Object.keys(dbInfo.properties));
    
    // 检查是否存在 KSP 属性（不区分大小写，忽略空格）
    const kspProps = Object.keys(dbInfo.properties).filter(k => 
      k.toLowerCase().replace(/\s+/g, '').match(/^ksp-?[1-5]$/)
    );
    const hasKSP = kspProps.length > 0;
    
    console.log('🔍 KSP 属性检测:', hasKSP ? `找到 ${kspProps.length} 个 (${kspProps.join(', ')})` : '未找到');
    
    // 获取页面数据
    const response = await notion.databases.query({database_id: db.id, page_size: 100});
    
    // 提取所有属性（排除特殊属性）
    const excludeProps = ['Model', 'Company', 'Image', ...kspProps];
    const allProperties = Object.entries(dbInfo.properties)
      .filter(([name, prop]) => !excludeProps.includes(name))
      .filter(([name, prop]) => ['number', 'select', 'checkbox', 'rich_text', 'date'].includes(prop.type))
      .map(([name, prop]) => ({
        name,
        type: prop.type,
        options: prop.type === 'select' ? prop.select.options : null
      }));
    
    const robots = response.results.map(page => {
      const p = page.properties;
      const specs = {};
      for (const [k,v] of Object.entries(p)) {
        if (excludeProps.includes(k)) continue;
        if (v.type==='number') specs[k]=v.number;
        else if (v.type==='select') specs[k]=v.select?.name||'';
        else if (v.type==='checkbox') specs[k]=v.checkbox?'✓':'✗';
        else if (v.type==='rich_text') specs[k]=v.rich_text?.[0]?.plain_text||'';
        else if (v.type==='date') specs[k]=v.date?.start||'';
      }
      
      // 提取 KSP 数据
      const ksp = [];
      if (hasKSP) {
        for (let i = 1; i <= 5; i++) {
          // 尝试多种可能的属性名格式
          const possibleNames = [`KSP-${i}`, `KSP ${i}`, `ksp-${i}`, `ksp${i}`];
          let kspValue = null;
          for (const name of possibleNames) {
            const prop = p[name];
            if (prop && prop.rich_text) {
              kspValue = prop.rich_text[0]?.plain_text || '';
              break;
            }
          }
          if (kspValue) ksp.push(kspValue);
        }
      }
      
      return {
        id: page.id,
        model: p.Model?.title?.[0]?.plain_text||'',
        company: p.Company?.select?.name||'',
        image: p.Image?.files?.[0]?.file?.url || p.Image?.files?.[0]?.external?.url || null,
        ksp,
        specs
      };
    });
    
    const result = { robots, properties: allProperties, hasKSP };
    cache.set(req.params.category, {data:result, time:Date.now()});
    console.log('✅ 数据获取成功，属性数量:', allProperties.length, hasKSP ? `(含 ${kspProps.length} 个 KSP)` : '(无KSP)');
    res.json(result);
  } catch(e) { 
    console.error('❌ API 错误:', e.message); 
    res.status(500).json({error:e.message}); 
  }
});

// 保存配置
app.post('/api/config/:category', async (req, res) => {
  try {
    const category = req.params.category;
    const configDb = databases.config;
    if (!configDb?.id) {
      return res.status(400).json({error: 'Config database not configured'});
    }
    
    const { specGroups } = req.body;
    const configText = JSON.stringify({ specGroups });
    
    // 查找是否已存在
    const response = await notion.databases.query({
      database_id: configDb.id,
      filter: {
        property: 'Category',
        title: { equals: category }
      }
    });
    
    if (response.results.length > 0) {
      // 更新
      await notion.pages.update({
        page_id: response.results[0].id,
        properties: {
          Config: {
            rich_text: [{ text: { content: configText } }]
          }
        }
      });
    } else {
      // 创建
      await notion.pages.create({
        parent: { database_id: configDb.id },
        properties: {
          Category: {
            title: [{ text: { content: category } }]
          },
          Config: {
            rich_text: [{ text: { content: configText } }]
          }
        }
      });
    }
    
    console.log('✅ 配置已保存到 Notion:', category);
    res.json({ success: true });
  } catch (e) {
    console.error('❌ 保存配置错误:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// 读取配置
app.get('/api/config/:category', async (req, res) => {
  try {
    const category = req.params.category;
    const configDb = databases.config;
    if (!configDb?.id) {
      return res.json({ specGroups: null });
    }
    
    const response = await notion.databases.query({
      database_id: configDb.id,
      filter: {
        property: 'Category',
        title: { equals: category }
      }
    });
    
    if (response.results.length > 0) {
      const configText = response.results[0].properties.Config?.rich_text?.[0]?.plain_text || '{}';
      const config = JSON.parse(configText);
      console.log('📖 配置已从 Notion 加载:', category);
      res.json(config);
    } else {
      console.log('📋 无保存配置，返回空');
      res.json({ specGroups: null });
    }
  } catch (e) {
    console.error('❌ 读取配置错误:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

const PORT = process.env.PORT || 4000;

// 本地开发模式
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

// Vercel Serverless 导出
export default app;
