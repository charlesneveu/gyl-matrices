import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'

type Bindings = {
  DB: D1Database
  ADMIN_PASSWORD: string
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

// --- Authentication Middleware ---
app.use('/api/*', async (c, next) => {
  // Allow unrestricted access to the login route
  if (c.req.path === '/api/login') {
    return next();
  }

  // Handle JWT validation
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized. Missing Bearer Token.' }, 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    // Requires JWT_SECRET to be defined in environment (wrangler or .dev.vars)
    await verify(token, c.env.JWT_SECRET, 'HS256');
    await next();
  } catch (e) {
    return c.json({ error: 'Invalid or expired token.' }, 401);
  }
});

// POST /api/login
app.post('/api/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.password) {
    return c.json({ error: 'Password is required' }, 400);
  }

  // Compare with the securely injected environment variable
  if (body.password !== c.env.ADMIN_PASSWORD) {
    return c.json({ error: 'Incorrect password' }, 401);
  }

  // Create highly secure JWT expiring in 30 days
  const payload = {
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days expiration
  };

  const token = await sign(payload, c.env.JWT_SECRET, 'HS256');
  return c.json({ success: true, token });
});

// --- PRODUCTS ---

// GET /api/products
app.get('/api/products', async (c) => {
  const page = Number(c.req.query('page') || '1')
  const limit = Number(c.req.query('limit') || '50')
  const offset = (page - 1) * limit

  const search = c.req.query('search') || ''

  try {
    let query = `SELECT * FROM catalog`
    const params: string[] = []

    if (search) {
      query += ` WHERE sku LIKE ? OR modele LIKE ?`
      params.push(`%${search}%`, `%${search}%`)
    }

    query += ` ORDER BY sku LIMIT ? OFFSET ?`
    params.push(limit.toString(), offset.toString())

    const { results } = await c.env.DB.prepare(query).bind(...params).all()
    
    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM catalog`
    const countParams: string[] = []
    if (search) {
      countQuery += ` WHERE sku LIKE ? OR modele LIKE ?`
      countParams.push(`%${search}%`, `%${search}%`)
    }
    const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first()
    const total = countResult?.total || 0

    // Flatten extra_data into root for frontend
    const flattenedResults = results.map((row: any) => {
      let extra = {};
      if (row.extra_data) {
        try { extra = JSON.parse(row.extra_data); } catch (e) {}
      }
      const { extra_data, ...baseFields } = row;
      return { ...baseFields, ...extra };
    });

    return c.json({
      data: flattenedResults,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(Number(total) / limit)
      }
    })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500)
  }
})

const VALID_COLUMNS = new Set([
  "sku", "ean", "url_images", "categorie", "modele", "size", "couleur", "asin", "url_amazon", "collection", "key", "second_key", "parentkey", "batch_unit", "code_couleur", "id_produit", "rigide_souple", "photos", "nouvelles_photos", "photos_details", "range_pictures", "titre_marketplaces", "titre_amazon", "description_marketplaces", "amazon_bulletpoint", "bulletpoint1", "bulletpoint2", "bulletpoint3", "bulletpoint4", "bulletpoint5", "bulletpoint6", "bulletpoint7", "composition_exterieure", "composition_interieure", "trolley", "poignee", "type_fermeture", "nombre_roues", "organisation_interieure", "type_cadenas", "garantie", "dimension_1", "dimension_2", "dimension_3", "dimension_4", "poids_1", "poids_2", "poids_3", "poids_4", "litre_1", "litre_2", "litre_3", "litre_4", "dimension_package", "poids_package"
]);

// GET /api/catalog/columns
app.get('/api/catalog/columns', async (c) => {
  try {
    // Scan dynamic columns from extra_data in recent products
    const { results } = await c.env.DB.prepare(`SELECT extra_data FROM catalog WHERE extra_data IS NOT NULL LIMIT 200`).all()
    const dynamicKeys = new Set<string>()
    results.forEach((r: any) => {
      if (r.extra_data) {
        try {
          const parsed = JSON.parse(r.extra_data);
          Object.keys(parsed).forEach(k => dynamicKeys.add(k));
        } catch (e) {}
      }
    })
    
    const allColumns = [...Array.from(VALID_COLUMNS), ...Array.from(dynamicKeys)]
    return c.json({ data: allColumns })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500)
  }
})

// POST /api/products (Batch import)
app.post('/api/products', async (c) => {
  try {
    const body = await c.req.json()
    // Backward compatibility: if it's an array, it's the old format (everything checked, overwrite mode)
    let products = Array.isArray(body) ? body : body.products;
    let insertCols = body.insertCols;
    let updateCols = body.updateCols;

    if (!Array.isArray(products)) {
      return c.json({ error: 'Expected an array of products' }, 400)
    }

    if (products.length === 0) return c.json({ success: true, count: 0 })

    // If backward compatible mode
    if (!insertCols || !updateCols) {
      const mode = c.req.query('mode') || 'overwrite';
      const payloadCols = new Set<string>();
      products.forEach((p) => Object.keys(p).forEach(k => {
         if (!k.startsWith('__EMPTY')) payloadCols.add(k);
      }));
      insertCols = Array.from(payloadCols);
      updateCols = mode === 'overwrite' ? insertCols : [];
    }

    const insertColsSet = new Set(insertCols.map((c: string) => c.toLowerCase()));
    const updateColsSet = new Set(updateCols.map((c: string) => c.toLowerCase()));

    // D1 batch support
    const statements = products.map(product => {
      const mainInsertCols: string[] = [];
      const mainInsertVals: any[] = [];
      const insertExtraData: Record<string, any> = {};
      
      const mainUpdateSet: string[] = [];
      const updateExtraData: Record<string, any> = {};

      for (const [key, value] of Object.entries(product)) {
        if (!key || key.toString().startsWith('__EMPTY')) continue;
        
        const lowerKey = key.toLowerCase();
        
        // 1. Build INSERT data
        if (insertColsSet.has(lowerKey)) {
          if (VALID_COLUMNS.has(lowerKey)) {
            mainInsertCols.push(lowerKey);
            mainInsertVals.push(value !== undefined ? value : null);
          } else {
            insertExtraData[key] = value;
          }
        }
        
        // 2. Build UPDATE data (only if SKU matched and column is selected for update)
        if (updateColsSet.has(lowerKey) && lowerKey !== 'sku') {
          if (VALID_COLUMNS.has(lowerKey)) {
            mainUpdateSet.push(`"${lowerKey}" = excluded."${lowerKey}"`);
          } else {
            updateExtraData[key] = value;
          }
        }
      }

      // Handle extra_data for INSERT
      mainInsertCols.push('extra_data');
      mainInsertVals.push(JSON.stringify(insertExtraData));

      // Handle extra_data for UPDATE
      if (Object.keys(updateExtraData).length > 0) {
        // We need 2 bound params for COALESCE(json_patch(catalog, ?), ?)
        mainUpdateSet.push(`"extra_data" = COALESCE(json_patch(catalog."extra_data", ?), ?)`);
        const jsonUpdateStr = JSON.stringify(updateExtraData);
        mainInsertVals.push(jsonUpdateStr, jsonUpdateStr);
      }

      const placeholders = mainInsertCols.map(() => '?').join(', ')
      const escapedCols = mainInsertCols.map(col => `"${col}"`).join(', ')
      
      let conflictAction = 'DO NOTHING';
      if (mainUpdateSet.length > 0) {
        conflictAction = `DO UPDATE SET ${mainUpdateSet.join(', ')}`;
      }
      
      const sql = `
        INSERT INTO catalog (${escapedCols})
        VALUES (${placeholders})
        ON CONFLICT(sku) ${conflictAction}
      `
      return c.env.DB.prepare(sql).bind(...mainInsertVals)
    })

    const chunkSize = 100 // D1 allows up to 100 statements per batch
    for (let i = 0; i < statements.length; i += chunkSize) {
      const chunk = statements.slice(i, i + chunkSize)
      await c.env.DB.batch(chunk)
    }

    return c.json({ success: true, count: products.length })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500)
  }
})

// PUT /api/products/:sku
app.put('/api/products/:sku', async (c) => {
  try {
    const sku = c.req.param('sku')
    const updates = await c.req.json()
    
    const columns = Object.keys(updates)
    if (columns.length === 0) return c.json({ error: 'No data to update' }, 400)

    const setParts = columns.map(col => `${col} = ?`).join(', ')
    const values = columns.map(col => updates[col])
    values.push(sku)

    const sql = `UPDATE catalog SET ${setParts} WHERE sku = ?`
    const result = await c.env.DB.prepare(sql).bind(...values).run()

    return c.json({ success: true, updated: result.meta.changes })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500)
  }
})

// --- TEMPLATES ---

// GET /api/templates
app.get('/api/templates', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`SELECT * FROM templates ORDER BY id DESC`).all()
    const templates = results.map((t: any) => ({
      ...t,
      mapping_json: t.mapping_json ? JSON.parse(t.mapping_json) : {}
    }))
    return c.json({ data: templates })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500)
  }
})

// POST /api/templates
app.post('/api/templates', async (c) => {
  try {
    const { partner_name, mapping_json } = await c.req.json()
    
    if (!partner_name || !mapping_json) {
      return c.json({ error: 'Missing partner_name or mapping_json' }, 400)
    }

    const mappingStr = JSON.stringify(mapping_json)

    const existing = await c.env.DB.prepare(`SELECT id FROM templates WHERE partner_name = ?`).bind(partner_name).first()
    
    if (existing) {
      await c.env.DB.prepare(`UPDATE templates SET mapping_json = ? WHERE id = ?`).bind(mappingStr, existing.id).run()
    } else {
      await c.env.DB.prepare(`INSERT INTO templates (partner_name, mapping_json) VALUES (?, ?)`).bind(partner_name, mappingStr).run()
    }

    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500)
  }
})

export default app
