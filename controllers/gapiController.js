const { bulkUpsertPlaces } = require('../models/placeModel');
const { getGMBData } = require('../controllers/gapi');
const { createJob, updateJobProgress, getJobs: getJobsFromDb } = require('../models/jobModel');
const { createLocation } = require('../models/locationModel');

async function runScrape(req, res) {
  try {
    const { query = '', lat, lng, radius = 20000 } = req.body || {};
    const userId = req.session?.userId || null;
    const name = query && String(query).trim().length ? String(query).trim() : (lat !== undefined && lng !== undefined ? `${lat},${lng}` : '');
    if (!name) return res.status(400).json({ error: 'query o lat/lng son requeridos' });

    const results = await getGMBData(name);
    if (!results) return res.status(502).json({ error: 'No se obtuvieron resultados del servicio' });
    console.log(`[runScrape] Processing ${results.length} results for query: ${name}`);
    const summary = await bulkUpsertPlaces(results, name, userId, null);
    console.log(`[runScrape] Summary:`, summary);
    res.json({ ok: true, summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function batchRun(req, res) {
  try {
    const { places } = req.body || {};
    const userId = req.session?.userId || null;
    if (!places || !Array.isArray(places) || places.length === 0) {
      return res.status(400).json({ error: 'places debe ser un array con al menos un lugar' });
    }

    const variations = [
      `negocios cerca de ${'${lugar}'}`,
      `sitios cerca de ${'${lugar}'}`,
      `lugares cerca de ${'${lugar}'}`,
      `servicios cerca de ${'${lugar}'}`,
      `comercios cerca de ${'${lugar}'}`,
      `empresas cerca de ${'${lugar}'}`,
      `actividades cerca de ${'${lugar}'}`,
      `tiendas cerca de ${'${lugar}'}`,
      `locales cerca de ${'${lugar}'}`,
      `servicios locales cerca de ${'${lugar}'}`,
      `oficinas cerca de ${'${lugar}'}`,
      `restaurantes cerca de ${'${lugar}'}`
    ];

    const createdJobs = [];
    for (const lugar of places) {
      const jobId = await createJob({ lugar, variationsTotal: variations.length, userId });
      createdJobs.push({ id: jobId });
      try { await createLocation({ name: lugar }); } catch(e) { /* ignore */ }

      (async (jobIdLocal, placeName) => {
        await updateJobProgress(jobIdLocal, { status: 'running' });
        let processed = 0;
        let totalInserted = 0;
        let totalUpdated = 0;
        let totalDuplicates = 0;
        for (const v of variations) {
          try {
            const query = v.replace(/\$\{lugar\}/g, placeName);
            const results = await getGMBData(query);
            if (results && results.length) {
              const summary = await bulkUpsertPlaces(results, query, userId, jobIdLocal);
              totalInserted += summary.inserted || 0;
              totalUpdated += summary.updated || 0;
              totalDuplicates += summary.duplicatesRemoved || 0;
              console.log(`[batchRun] Job ${jobIdLocal} - Query "${query}": ${summary.total} processed, ${summary.inserted} inserted, ${summary.updated} updated, ${summary.duplicatesRemoved} duplicates removed`);
            }
          } catch (err) {
            console.error('Error processing variation', err.message || err);
          } finally {
            processed += 1;
            await updateJobProgress(jobIdLocal, { processed });
          }
          await new Promise(r => setTimeout(r, 800));
        }
        console.log(`[batchRun] Job ${jobIdLocal} completed: ${totalInserted} inserted, ${totalUpdated} updated, ${totalDuplicates} duplicates removed`);
        await updateJobProgress(jobIdLocal, { status: 'done', finishedAt: new Date().toISOString() });
      })(jobId, lugar);
    }

    res.json({ ok: true, jobs: createdJobs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function getJobs(req, res) {
  try {
    const userId = req.session?.userId || null;
    const userRole = req.session?.userRole || 'admin';
    const rows = await getJobsFromDb(userId, userRole);
    res.json({ jobs: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function runVariations(req, res) {
  try {
    const { lugar } = req.body || {};
    const userId = req.session?.userId || null;
    if (!lugar || !String(lugar).trim()) return res.status(400).json({ error: 'lugar es requerido' });
    const placeName = String(lugar).trim();
    const variations = [
      `negocios cerca de ${'${lugar}'}`,
      `sitios cerca de ${'${lugar}'}`,
      `lugares cerca de ${'${lugar}'}`,
      `servicios cerca de ${'${lugar}'}`,
      `comercios cerca de ${'${lugar}'}`,
      `empresas cerca de ${'${lugar}'}`,
      `actividades cerca de ${'${lugar}'}`,
      `tiendas cerca de ${'${lugar}'}`,
      `locales cerca de ${'${lugar}'}`,
      `servicios locales cerca de ${'${lugar}'}`,
      `oficinas cerca de ${'${lugar}'}`,
      `restaurantes cerca de ${'${lugar}'}`
    ];

    const jobId = await createJob({ lugar: placeName, variationsTotal: variations.length, userId });
    try { await createLocation({ name: placeName }); } catch(e) { /* ignore */ }

    (async (jobIdLocal, placeNameLocal, userIdLocal) => {
      await updateJobProgress(jobIdLocal, { status: 'running' });
      let processed = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalDuplicates = 0;
      for (const v of variations) {
        try {
          const query = v.replace(/\$\{lugar\}/g, placeNameLocal);
          const results = await getGMBData(query);
          if (results && results.length) {
            const summary = await bulkUpsertPlaces(results, query, userIdLocal, jobIdLocal);
            totalInserted += summary.inserted || 0;
            totalUpdated += summary.updated || 0;
            totalDuplicates += summary.duplicatesRemoved || 0;
            console.log(`[runVariations] Job ${jobIdLocal} - Query "${query}": ${summary.total} processed, ${summary.inserted} inserted, ${summary.updated} updated, ${summary.duplicatesRemoved} duplicates removed`);
          }
        } catch (err) {
          console.error('Error processing variation', err.message || err);
        } finally {
          processed += 1;
          await updateJobProgress(jobIdLocal, { processed });
        }
        await new Promise(r => setTimeout(r, 800));
      }
      console.log(`[runVariations] Job ${jobIdLocal} completed: ${totalInserted} inserted, ${totalUpdated} updated, ${totalDuplicates} duplicates removed`);
      await updateJobProgress(jobIdLocal, { status: 'done', finishedAt: new Date().toISOString() });
    })(jobId, placeName, userId);

    res.json({ ok: true, job: { id: jobId } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { runScrape, batchRun, getJobs, runVariations };
