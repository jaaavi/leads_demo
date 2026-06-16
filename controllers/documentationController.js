async function getAdminDocumentation(req, res) {
  try {
    res.render('admin/documentation', { session: req.session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { getAdminDocumentation };
