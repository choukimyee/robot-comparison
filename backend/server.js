const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');
require('dotenv').config();

const app = express();
const notion = new Client({ auth: process.env.NOTION_TOKEN });

app.use(cors());
app.use(express.json());

const DB_CONFIG = process.env.DB_CONFIG || process.env.DATABASE_ID; // 配置数据库ID

// 数据库映射
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

// 分类配置
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

// ===== 配置 API 路由 =====

// GET /api/config/:category - 读取配置
app.get('/api/config/:category', async (req, res) => {
  try {
    const { category } = req.params;
    console.log(`📖 读取配置: ${category}`);

    if (!DB_CONFIG) {
      return res.json({ specGroups: [] });
    }

    // 查询配置数据库
    const response = await notion.databases.query({
      database_id: DB_CONFIG,
      filter: {
        property: 'Category',
        title: {
          equals: category
        }
      }
    });

    if (response.results.length > 0) {
      const page = response.results[0];
      const configText = page.properties.Config?.rich_text?.[0]?.plain_text || '{}';
      const config = JSON.parse(configText);
      console.log(`✅ 配置已加载: ${category}`);
      return res.json(config);
    }

    console.log(`📋 无配置，返回空: ${category}`);
    res.json({ specGroups: [] });
  } catch (error) {
    console.error('❌ 读取配置失败:', error.message);
    res.json({ specGroups: [] });
  }
});

// POST /api/config/:category - 保存配置
app.post('/api/config/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { specGroups } = req.body;
    console.log(`💾 保存配置: ${category}`);

    if (!DB_CONFIG) {
      return res.status(500).json({ error: 'DB_CONFIG not configured' });
    }

    // 查询是否已存在
    const queryResponse = await notion.databases.query({
      database_id: DB_CONFIG,
      filter: {
        property: 'Category',
        title: {
          equals: category
        }
      }
    });

    const configText = JSON.stringify({ specGroups });

    if (queryResponse.results.length > 0) {
      // 更新现有配置
      const pageId = queryResponse.results[0].id;
      await notion.pages.update({
        page_id: pageId,
        properties: {
          Config: {
            rich_text: [{
              text: { content: configText }
            }]
          }
        }
      });
      console.log(`✅ 配置已更新: ${category}`);
    } else {
      // 创建新配置
      await notion.pages.create({
        parent: { database_id: DB_CONFIG },
        properties: {
          Category: {
            title: [{
              text: { content: category }
            }]
          },
          Config: {
            rich_text: [{
              text: { content: configText }
            }]
          }
        }
      });
      console.log(`✅ 配置已创建: ${category}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ 保存配置失败:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===== 原有的机器人数据 API =====

// GET /api/categories
app.get('/api/categories', (req, res) => {
  res.json(categories);
});

// GET /api/robots/:category
app.get('/api/robots/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const databaseId = databases[category];

    if (!databaseId) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const response = await notion.databases.retrieve({
      database_id: databaseId
    });

    const schema = response.properties;
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

      // KSP
      for (let i = 1; i <= 5; i++) {
        const kspKey = `KSP-${i}`;
        robot.ksp.push(props[kspKey]?.rich_text?.[0]?.plain_text || '');
      }

      // 其他参数
      Object.keys(schema).forEach(key => {
        if (key === 'Model' || key === 'Company' || key === 'Image' || key.startsWith('KSP-')) return;
        
        const prop = props[key];
        if (!prop) return;

        switch (schema[key].type) {
          case 'number':
            robot.specs[key] = prop.number;
            break;
          case 'select':
            robot.specs[key] = prop.select?.name || null;
            break;
          case 'rich_text':
          case 'text':
            robot.specs[key] = prop.rich_text?.[0]?.plain_text || null;
            break;
          case 'url':
            robot.specs[key] = prop.url || null;
            break;
          default:
            break;
        }
      });

      return robot;
    });

    res.json({ robots, properties, hasKSP });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 配置数据库 ID: ${DB_CONFIG || '未配置'}`);
});
