const app = require('./api');

const PORT = process.env.PORT || 4080;

app.listen(PORT, () => {
  console.log(`Leads demo running at http://localhost:${PORT}`);
});
