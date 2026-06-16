const axios = require('axios');
const { prepare, buildResults } = require('../utils/gapi_parse');


const numResults = 200

const config = {
    headers: {
        'Accept': 'application/json',
    }
};

// Función para hacer la petición GET
async function getGMBData(name) {
    try {

        var url = `https://www.google.com/search?tbm=map&authuser=0&hl=es&gl=es&pb=!4m12!1m3!1d30464.869968129344!2d-3.7123128434352712!3d40.431078988829455!2m3!1f0!2f0!3f0!3m2!1i800!2i963!4f13.1!7i${numResults}!10b1!12m16!1m1!18b1!2m3!5m1!6e2!20e3!10b1!12b1!13b1!16b1!17m1!3e1!20m3!5e2!6b1!14b1!19m4!2m3!1i360!2i120!4i8!20m57!2m2!1i203!2i100!3m2!2i4!5b1!6m6!1m2!1i86!2i86!1m2!1i408!2i240!7m42!1m3!1e1!2b0!3e3!1m3!1e2!2b1!3e2!1m3!1e2!2b0!3e3!1m3!1e8!2b0!3e3!1m3!1e10!2b0!3e3!1m3!1e10!2b1!3e2!1m3!1e9!2b1!3e2!1m3!1e10!2b0!3e3!1m3!1e10!2b1!3e2!1m3!1e10!2b0!3e4!2b1!4b1!9b0!22m6!1s5DBbZp2WOc269u8P0PW-4AM%3A6!2s1i%3A0%2Ct%3A11886%2Cp%3A5DBbZp2WOc269u8P0PW-4AM%3A6!7e81!12e5!17s5DBbZp2WOc269u8P0PW-4AM%3A91!18e15!24m99!1m31!13m9!2b1!3b1!4b1!6i1!8b1!9b1!14b1!20b1!25b1!18m20!3b1!4b1!5b1!6b1!9b1!12b1!13b1!14b1!17b1!20b1!21b1!22b1!25b1!27m1!1b0!28b0!31b0!32b0!33m1!1b0!10m1!8e3!11m1!3e1!14m1!3b1!17b1!20m2!1e3!1e6!24b1!25b1!26b1!29b1!30m1!2b1!36b1!39m3!2m2!2i1!3i1!43b1!52b1!54m1!1b1!55b1!56m1!1b1!65m5!3m4!1m3!1m2!1i224!2i298!71b1!72m19!1m5!1b1!2b1!3b1!5b1!7b1!4b1!8m10!1m6!4m1!1e1!4m1!1e3!4m1!1e4!3sother_user_reviews!6m1!1e1!9b1!89b1!103b1!113b1!114m3!1b1!2m1!1b1!117b1!122m1!1b1!125b0!127b1!26m4!2m3!1i80!2i92!4i8!30m28!1m6!1m2!1i0!2i0!2m2!1i530!2i963!1m6!1m2!1i750!2i0!2m2!1i800!2i963!1m6!1m2!1i0!2i0!2m2!1i800!2i20!1m6!1m2!1i0!2i943!2m2!1i800!2i963!34m18!2b1!3b1!4b1!6b1!8m6!1b1!3b1!4b1!5b1!6b1!7b1!9b1!12b1!14b1!20b1!23b1!25b1!26b1!37m1!1e81!42b1!47m0!49m8!3b1!6m2!1b1!2b1!7m2!1e3!2b1!8b1!50m4!2e2!3m2!1b1!3b1!61b1!67m2!7b1!10b1!69i694&q=${name}&oq=${name}&gs_l=maps.3..38i39i129k1j38i426k1j38i377k1j38i426k1j38i377k1.0.0.3.6370.1.1.....115.115.0j1.1.....0......maps..0.1.147.0.&tch=1&ech=3&psi=5DBbZp2WOc269u8P0PW-4AM.1717252327232.1`;

        const response = await axios.get(url, config);
        
        var json = JSON.parse(response.data.split('/*""*/')[0])
        var rawInput = json.d;
        const preparedData = prepare(rawInput)
        const listResults = buildResults(preparedData)

        console.log(listResults.length)

        return listResults;
    } catch (error) {
        console.error('Error haciendo la petición GET:', error);
    }
}
module.exports = {
    getGMBData
}