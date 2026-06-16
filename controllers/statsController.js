const pool = require('../db/localdata');

async function getLeadStats(req, res) {
  try {
    let whereClause = 'deleted_at IS NULL';
    const params = [];

    const userRole = req.session?.userRole || 'admin';
    const userId = req.session?.userId;

    // If comercial, only show their own stats
    if ((userRole === 'comercial' || userRole === 'comercial_pro') && userId) {
      whereClause = 'assigned_to = ? AND deleted_at IS NULL';
      params.push(userId);
    }

    if (req.query.from_date && req.query.to_date) {
      if ((userRole === 'comercial' || userRole === 'comercial_pro') && userId) {
        whereClause += ' AND created_at BETWEEN ? AND ?';
        params.push(req.query.from_date, req.query.to_date);
      } else {
        whereClause = 'created_at BETWEEN ? AND ? AND deleted_at IS NULL';
        params.push(req.query.from_date, req.query.to_date);
      }
    }

    // Total leads
    const [totalResult] = await pool.execute(`SELECT COUNT(*) as total FROM leads WHERE ${whereClause}`, params);
    const totalLeads = totalResult[0]?.total || 0;

    // Leads by status
    const [statusResult] = await pool.execute(
      `SELECT status, COUNT(*) as count FROM leads WHERE ${whereClause} GROUP BY status`,
      params
    );
    const statusBreakdown = {};
    statusResult.forEach(row => {
      statusBreakdown[row.status] = row.count;
    });

    // Leads by source (if source column exists)
    let sourceBreakdown = {};
    try {
      const [sourceResult] = await pool.execute(
        `SELECT source, COUNT(*) as count FROM leads WHERE ${whereClause} AND source IS NOT NULL AND source != '' GROUP BY source`,
        params
      );
      sourceResult.forEach(row => {
        sourceBreakdown[row.source] = row.count;
      });
    } catch (e) {
      sourceBreakdown = { 'scraper': totalLeads };
    }

    // Total metrics
    const closedLeads = statusBreakdown['closed'] || 0;
    const conversionRate = totalLeads > 0 ? ((closedLeads / totalLeads) * 100).toFixed(2) : 0;

    res.json({
      summary: {
        totalLeads,
        contacted: statusBreakdown['contacted'] || 0,
        interested: statusBreakdown['interested'] || 0,
        negotiation: statusBreakdown['negotiation'] || 0,
        closed: statusBreakdown['closed'] || 0,
        discarded: statusBreakdown['discarded'] || 0,
        conversionRate: parseFloat(conversionRate),
        totalValue: 0,
        totalBenefit: 0,
        avgClosingDays: 0,
        costPerLead: 0,
        avgBenefitPerLead: 0
      },
      statusBreakdown,
      sourceBreakdown,
      assignedBreakdown: []
    });
  } catch (e) {
    console.error('Stats error:', e.message);
    res.json({
      summary: {
        totalLeads: 0,
        contacted: 0,
        interested: 0,
        negotiation: 0,
        closed: 0,
        discarded: 0,
        conversionRate: 0,
        totalValue: 0,
        totalBenefit: 0,
        avgClosingDays: 0,
        costPerLead: 0,
        avgBenefitPerLead: 0
      },
      statusBreakdown: {},
      sourceBreakdown: {},
      assignedBreakdown: []
    });
  }
}

async function getLeadsFunnelStats(req, res) {
  try {
    let whereClause = 'deleted_at IS NULL';
    const params = [];

    const userRole = req.session?.userRole || 'admin';
    const userId = req.session?.userId;

    // If comercial, only show their own stats
    if ((userRole === 'comercial' || userRole === 'comercial_pro') && userId) {
      whereClause = 'assigned_to = ? AND deleted_at IS NULL';
      params.push(userId);
    }

    if (req.query.from_date && req.query.to_date) {
      if ((userRole === 'comercial' || userRole === 'comercial_pro') && userId) {
        whereClause += ' AND created_at BETWEEN ? AND ?';
        params.push(req.query.from_date, req.query.to_date);
      } else {
        whereClause = 'created_at BETWEEN ? AND ? AND deleted_at IS NULL';
        params.push(req.query.from_date, req.query.to_date);
      }
    }

    const [results] = await pool.execute(
      `SELECT status, COUNT(*) as count FROM leads WHERE ${whereClause} GROUP BY status`,
      params
    );

    const funnel = {
      new: 0,
      contacted: 0,
      interested: 0,
      negotiation: 0,
      closed: 0,
      discarded: 0
    };

    results.forEach(row => {
      if (funnel.hasOwnProperty(row.status)) {
        funnel[row.status] = row.count;
      }
    });

    res.json({ funnel });
  } catch (e) {
    res.json({ 
      funnel: {
        new: 0,
        contacted: 0,
        interested: 0,
        negotiation: 0,
        closed: 0,
        discarded: 0
      }
    });
  }
}

async function getMonthlyStats(req, res) {
  try {
    const userRole = req.session?.userRole || 'admin';
    const userId = req.session?.userId;

    let whereClause = 'WHERE deleted_at IS NULL';
    const params = [];
    if ((userRole === 'comercial' || userRole === 'comercial_pro') && userId) {
      whereClause = 'WHERE assigned_to = ? AND deleted_at IS NULL';
      params.push(userId);
    }

    const [results] = await pool.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') as month,
              COUNT(*) as leads_created,
              SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as leads_closed
       FROM leads
       ${whereClause}
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month DESC
       LIMIT 12`,
      params
    );

    res.json({ monthly: results || [] });
  } catch (e) {
    res.json({ monthly: [] });
  }
}

async function getSourcePerformance(req, res) {
  try {
    const userRole = req.session?.userRole || 'admin';
    const userId = req.session?.userId;

    let whereClause = 'WHERE source IS NOT NULL AND source != \'\' AND deleted_at IS NULL';
    const params = [];

    if ((userRole === 'comercial' || userRole === 'comercial_pro') && userId) {
      whereClause += ' AND assigned_to = ?';
      params.push(userId);
    }

    const [results] = await pool.execute(
      `SELECT source,
              COUNT(*) as total_leads,
              SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_leads
       FROM leads
       ${whereClause}
       GROUP BY source
       ORDER BY total_leads DESC`,
      params
    );

    const performance = results.map(row => ({
      source: row.source,
      totalLeads: row.total_leads,
      closedLeads: row.closed_leads || 0,
      conversionRate: row.total_leads > 0 ? ((row.closed_leads || 0) / row.total_leads * 100).toFixed(2) : 0,
      totalRevenue: 0,
      profitability: 0
    }));

    res.json({ performance });
  } catch (e) {
    res.json({ performance: [] });
  }
}

async function getUserPerformance(req, res) {
  try {
    const userRole = req.session?.userRole || 'admin';
    const userId = req.session?.userId;

    let whereClause = '';
    const params = [];

    if ((userRole === 'comercial' || userRole === 'comercial_pro') && userId) {
      // For comercial users, only show their own performance
      whereClause = 'WHERE u.id = ?';
      params.push(userId);
    }

    const [results] = await pool.execute(
      `SELECT u.id, u.username,
              COUNT(l.id) as leads_managed,
              SUM(CASE WHEN l.status = 'closed' THEN 1 ELSE 0 END) as leads_closed
       FROM users u
       LEFT JOIN leads l ON u.id = l.assigned_to AND l.deleted_at IS NULL
       ${whereClause}
       GROUP BY u.id, u.username
       ORDER BY leads_closed DESC`,
      params
    );

    const performance = results.map(row => ({
      userId: row.id,
      username: row.username,
      leadsManaged: row.leads_managed || 0,
      leadsClosed: row.leads_closed || 0,
      successRate: row.leads_managed > 0 ? ((row.leads_closed || 0) / row.leads_managed * 100).toFixed(2) : 0,
      totalRevenue: 0
    }));

    res.json({ performance });
  } catch (e) {
    res.json({ performance: [] });
  }
}

module.exports = { getLeadStats, getLeadsFunnelStats, getMonthlyStats, getSourcePerformance, getUserPerformance };
