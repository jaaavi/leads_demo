const { detectPhoneType, normalizePhoneNumber } = require('./phoneTypeDetector');

function prepare(input) {
    // There are 5 random characters before the JSON object we need to remove
    // Also I found that the newlines were messing up the JSON parsing,
    // so I removed those and it worked.
    const preparedForParsing = input.substring(5).replace(/\n/g, '')
    const json = JSON.parse(preparedForParsing)
    const results = json[0][1].map(array => array[14])
    return results
}

function prepareLookup(data) {

    // this function takes a list of indexes as arguments
    // constructs them into a line of code and then 
    // execs the retrieval in a try/catch to handle data not being present
    return function lookup(...indexes) {
        const indexesWithBrackets = indexes.reduce((acc, cur) => `${acc}[${cur}]`, '')
        const cmd = `data${indexesWithBrackets}`
        try {
            const result = eval(cmd)
            return result
        } catch(e) {
            return null
        }
    }
}


function buildResults(preparedData) {
  const results = [];
  for (const place of preparedData) {
    const lookup = prepareLookup(place);

    // Extraer categoría principal y etiquetas de forma segura
    const rawCategory = lookup(76) || lookup(13);
    let category = null;

    if (Array.isArray(rawCategory)) {
      // Si son arrays anidados, nos quedamos con los textos
      category = rawCategory
        .flat()
        .filter((x) => typeof x === "string")
        .join(", ");
    } else if (typeof rawCategory === "string") {
      category = rawCategory;
    }

    const tags = lookup(13);
    let tagList = null;
    if (Array.isArray(tags)) {
      tagList = tags
        .flat()
        .filter((x) => typeof x === "string")
        .join(", ");
    }

    const rawPhone = lookup(178, 0, 0);
    const normalizedPhone = normalizePhoneNumber(rawPhone);
    const phoneType = normalizedPhone ? detectPhoneType(normalizedPhone) : null;

    const result = {
      name: lookup(11),
      category: category,
      tags: tagList,
      notes: lookup(25, 15, 0, 2),
      placeId: lookup(78),
      phone: normalizedPhone,
      phone_type: phoneType,
      address: {
        street_address: lookup(183, 1, 2),
        city: lookup(183, 1, 3),
        zip: lookup(183, 1, 4),
        state: lookup(183, 1, 5),
        country_code: lookup(183, 1, 6),
      },
      coordinates: {
        long: lookup(208, 0, 2),
        lat: lookup(208, 0, 3),
      },
      web: lookup(7, 1),
    };

    results.push(result);
  }

  return results;
}




module.exports = {
  prepare,
  buildResults
}
