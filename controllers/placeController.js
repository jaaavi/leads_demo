const { listPlaces, getMeta, getPlaceById, createPlace, updatePlaceById, deletePlaceById, getPlacesCities } = require('../models/placeModel');
const { createLeadAndUpdatePlace } = require('../models/leadModel');


async function getPlaces(req, res) {
  try {
    const { page, pageSize, mainCategory, city, barrio, hasWeb, hasPhone, q, tag, phoneType, jobId } = req.query;
    const userId = req.session?.userId || null;
    const userRole = req.session?.userRole || 'admin';

    // For comercial_pro users, only show their own places
    const filterUserId = userRole === 'comercial_pro' ? userId : null;

    // Note: hasWeb defaults to undefined when not provided, which means "show ALL places" (with and without web)
    // Possible values: '1' (with web), '0' (without web), 'social' (social media only)
    console.log('[getPlaces] Filters:', { page, pageSize, mainCategory, city, barrio, hasWeb, hasPhone, q, tag, phoneType, jobId });
    const data = await listPlaces({ page: Number(page) || 1, pageSize: Number(pageSize) || 20, mainCategory, city, barrio, hasWeb, hasPhone, q, tag, phoneType, jobId: jobId ? Number(jobId) : null, userId: filterUserId });
    console.log('[getPlaces] Results:', { total: data?.total, returned: data?.data?.length });
    res.json(data || { data: [], total: 0, page: 1, pageSize: 20 });
  } catch (e) {
    console.error('Error in getPlaces:', e);
    res.status(500).json({ error: e.message, data: [], total: 0 });
  }
}

async function getPlacesMeta(req, res) {
  try {
    const userId = req.session?.userId || null;
    const userRole = req.session?.userRole || 'admin';
    const filterUserId = userRole === 'comercial_pro' ? userId : null;
    const meta = await getMeta(filterUserId);

    // Get list of jobs
    let jobs = [];
    try {
      const jobModel = require('../models/jobModel');
      if (jobModel && jobModel.getJobs) {
        jobs = await jobModel.getJobs(userRole === 'comercial_pro' ? userId : null, userRole);
        console.log('[getPlacesMeta] Jobs fetched:', jobs.length > 0 ? `${jobs.length} jobs` : 'No jobs found');
      }
    } catch (e) {
      console.warn('Error fetching jobs for places meta:', e.message);
    }

    console.log('[getPlacesMeta] Returning meta with jobs:', { jobs: jobs.length });
    res.json({ ok: true, categories: meta.mainCategories, tags: meta.tags, cities: meta.cities, barrios: meta.barrios, phoneTypes: meta.phoneTypes, jobs: jobs || [] });
  } catch (e) {
    console.error('Error in getPlacesMeta:', e);
    res.status(500).json({ error: e.message, categories: [], tags: [], cities: [], barrios: [], phoneTypes: [], jobs: [] });
  }
}

async function getJobs(req, res) {
  try {
    const userId = req.session?.userId || null;
    const userRole = req.session?.userRole || 'admin';

    const { getJobs: getJobsModel } = require('../models/jobModel');
    const jobs = await getJobsModel(userRole === 'comercial_pro' ? userId : null, userRole);

    res.json({ ok: true, jobs: jobs || [] });
  } catch (e) {
    console.error('Error fetching jobs:', e);
    res.status(500).json({ error: e.message, jobs: [] });
  }
}

async function getPlace(req, res) {
  try {
    const id = Number(req.params.id);
    const place = await getPlaceById(id);
    if (!place) return res.status(404).json({ error: 'No encontrado' });
    res.json(place);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function postPlace(req, res) {
  try {
    const id = await createPlace(req.body || {});
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function putPlace(req, res) {
  try {
    const id = Number(req.params.id);
    await updatePlaceById(id, req.body || {});
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function delPlace(req, res) {
  try {
    const id = Number(req.params.id);
    const affected = await deletePlaceById(id);
    res.json({ ok: true, affected });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function createLeadFromPlace(req, res) {
  try {
    const id = Number(req.params.id);
    const userId = req.session?.userId || null;
    const userRole = req.session?.userRole || 'admin';

    const place = await getPlaceById(id);
    if (!place) return res.status(404).json({ error: 'place not found' });

    // For comercial_pro users, assign the lead to themselves automatically
    const assignedTo = (userRole === 'comercial_pro' && userId) ? userId : null;

    const lead = await createLeadAndUpdatePlace({
      place_id: id,
      full_name: place.name,
      email: null,
      phone: place.phone,
      web: place.web,
      source: 'scraper',
      status: 'new',
      notes: `from place ${place.place_id || ''}`,
      assigned_to: assignedTo,
      user_id: userId
    });
    res.json({ ok: true, lead });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function createLeadsFromPlaces(req, res) {
  try {
    const { place_ids } = req.body;
    if (!Array.isArray(place_ids) || place_ids.length === 0) {
      return res.status(400).json({ error: 'place_ids must be a non-empty array' });
    }

    const userId = req.session?.userId || null;
    const userRole = req.session?.userRole || 'admin';
    const assignedTo = (userRole === 'comercial_pro' && userId) ? userId : null;

    const results = [];
    for (const place_id of place_ids) {
      const id = Number(place_id);
      try {
        const place = await getPlaceById(id);
        if (!place) continue;
        if (place.lead_id) continue; // Skip already converted
        const lead = await createLeadAndUpdatePlace({
          place_id: id,
          full_name: place.name,
          email: null,
          phone: place.phone,
          web: place.web,
          source: 'scraper',
          status: 'new',
          notes: `from place ${place.place_id || ''}`,
          assigned_to: assignedTo,
          user_id: userId
        });
        results.push({ place_id: id, success: true, lead_id: lead.id });
      } catch (e) {
        results.push({ place_id: id, success: false, error: e.message });
      }
    }

    res.json({ ok: true, results, converted: results.filter(r => r.success).length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function bulkDeletePlaces(req, res) {
  try {
    const { place_ids } = req.body || {};
    if (!Array.isArray(place_ids) || place_ids.length === 0) {
      return res.status(400).json({ error: 'place_ids debe ser un array no vacío' });
    }

    const ids = place_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x));
    const { deletePlaceById } = require('../models/placeModel');

    let deleted = 0;
    for (const id of ids) {
      try {
        const resDel = await deletePlaceById(id);
        deleted += resDel > 0 ? 1 : 0;
      } catch (e) {
        // Continue deleting others
      }
    }
    return res.json({ ok: true, deleted });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

async function createLeadsFromPlacesAssign(req, res) {
  try {
    const { place_ids, assign_to } = req.body;
    if (!Array.isArray(place_ids) || place_ids.length === 0) {
      return res.status(400).json({ error: 'place_ids must be a non-empty array' });
    }

    if (!assign_to && assign_to !== 0) {
      return res.status(400).json({ error: 'assign_to is required' });
    }

    const userId = req.session?.userId || null;
    const assignedTo = Number(assign_to);

    const results = [];
    for (const place_id of place_ids) {
      const id = Number(place_id);
      try {
        const place = await getPlaceById(id);
        if (!place) continue;
        if (place.lead_id) continue; // Skip already converted
        const lead = await createLeadAndUpdatePlace({
          place_id: id,
          full_name: place.name,
          email: null,
          phone: place.phone,
          web: place.web,
          source: 'scraper',
          status: 'new',
          notes: `from place ${place.place_id || ''}`,
          assigned_to: assignedTo,
          user_id: userId
        });
        results.push({ place_id: id, success: true, lead_id: lead.id });
      } catch (e) {
        results.push({ place_id: id, success: false, error: e.message });
      }
    }

    res.json({ ok: true, results, converted: results.filter(r => r.success).length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { getPlaces, getPlacesMeta, getPlace, postPlace, putPlace, delPlace, createLeadFromPlace, createLeadsFromPlaces, bulkDeletePlaces, createLeadsFromPlacesAssign };
