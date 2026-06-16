/**
 * Generaliza una categoría específica a una categoría general
 * @param {string} raw - Categoría específica (puede ser una o varias)
 * @returns {string} Categoría generalizada
 */
function generalizarCategoria(raw) {
  if (!raw) return 'Otro';
  
  const texto = String(raw).toLowerCase();

  // Restaurantes y comida
  if (texto.includes('restaurant') || texto.includes('restaurante')) return 'Restaurante';
  if (texto.includes('bar') || texto.includes('pub') || texto.includes('lounge')) return 'Bar';
  if (texto.includes('cafe') || texto.includes('coffee') || texto.includes('cafetería')) return 'Cafetería';
  if (texto.includes('pizza')) return 'Pizzería';
  if (texto.includes('burger') || texto.includes('hamburguesa')) return 'Fast Food';
  if (texto.includes('bakery') || texto.includes('panadería') || texto.includes('pastelería')) return 'Panadería';
  if (texto.includes('ice_cream') || texto.includes('helado')) return 'Heladería';
  if (texto.includes('meal_delivery') || texto.includes('takeaway') || texto.includes('comida para llevar')) return 'Comida para llevar';

  // Tiendas
  if (texto.includes('store') || texto.includes('shop') || texto.includes('tienda')) return 'Tienda';
  if (texto.includes('supermarket') || texto.includes('market') || texto.includes('supermercado')) return 'Supermercado';
  if (texto.includes('grocery') || texto.includes('grocery_or_supermarket')) return 'Supermercado';
  if (texto.includes('clothing') || texto.includes('ropa')) return 'Tienda de ropa';
  if (texto.includes('shoe') || texto.includes('zapatos')) return 'Tienda de zapatos';
  if (texto.includes('jewelry') || texto.includes('joyas')) return 'Joyería';
  if (texto.includes('book') || texto.includes('librería')) return 'Librería';
  if (texto.includes('electronics') || texto.includes('electrónica')) return 'Electrónica';
  if (texto.includes('furniture') || texto.includes('muebles')) return 'Mueblería';
  if (texto.includes('hardware') || texto.includes('ferretería')) return 'Ferretería';
  if (texto.includes('sporting_goods') || texto.includes('deportes')) return 'Tienda de deportes';

  // Salud
  if (texto.includes('clinic') || texto.includes('clínica') || texto.includes('hospital')) return 'Clínica';
  if (texto.includes('dentist') || texto.includes('dental') || texto.includes('dentista')) return 'Dentista';
  if (texto.includes('pharmacy') || texto.includes('farmacia')) return 'Farmacia';
  if (texto.includes('doctor') || texto.includes('physician') || texto.includes('médico')) return 'Médico';
  if (texto.includes('veterinary') || texto.includes('veterinario')) return 'Veterinario';
  if (texto.includes('health') || texto.includes('salud')) return 'Salud';

  // Belleza y bienestar
  if (texto.includes('hair') || texto.includes('barbershop') || texto.includes('peluquería')) return 'Peluquería';
  if (texto.includes('beauty') || texto.includes('salón') || texto.includes('estética')) return 'Salón de belleza';
  if (texto.includes('spa') || texto.includes('massage') || texto.includes('masaje')) return 'Spa';
  if (texto.includes('gym') || texto.includes('fitness') || texto.includes('gimnasio')) return 'Gimnasio';

  // Alojamiento
  if (texto.includes('hotel') || texto.includes('hotel')) return 'Hotel';
  if (texto.includes('hostel') || texto.includes('albergue')) return 'Albergue';
  if (texto.includes('lodging') || texto.includes('bed_and_breakfast')) return 'Alojamiento';

  // Transporte y automóvil
  if (texto.includes('car') || texto.includes('auto') || texto.includes('coche')) return 'Automoción';
  if (texto.includes('garage') || texto.includes('taller')) return 'Taller mecánico';
  if (texto.includes('gas_station') || texto.includes('gasolinera')) return 'Gasolinera';
  if (texto.includes('parking') || texto.includes('aparcamiento')) return 'Aparcamiento';
  if (texto.includes('car_rental') || texto.includes('alquiler')) return 'Alquiler de vehículos';

  // Oficinas y negocios
  if (texto.includes('office') || texto.includes('office_building') || texto.includes('oficina')) return 'Oficina';
  if (texto.includes('accounting') || texto.includes('contabilidad')) return 'Contabilidad';
  if (texto.includes('lawyer') || texto.includes('legal') || texto.includes('abogado')) return 'Abogado';
  if (texto.includes('real_estate') || texto.includes('inmobiliaria')) return 'Inmobiliaria';

  // Educación
  if (texto.includes('school') || texto.includes('colegio') || texto.includes('escuela')) return 'Educación';
  if (texto.includes('academy') || texto.includes('university') || texto.includes('universidad')) return 'Educación';
  if (texto.includes('library') || texto.includes('biblioteca')) return 'Biblioteca';

  // Entretenimiento y ocio
  if (texto.includes('movie_theater') || texto.includes('cine')) return 'Cine';
  if (texto.includes('museum') || texto.includes('museo')) return 'Museo';
  if (texto.includes('park') || texto.includes('parque')) return 'Parque';
  if (texto.includes('amusement') || texto.includes('diversión')) return 'Parque temático';
  if (texto.includes('art_gallery') || texto.includes('galería')) return 'Galería de arte';
  if (texto.includes('night_club') || texto.includes('discoteca')) return 'Discoteca';
  if (texto.includes('tourist_attraction') || texto.includes('atracción')) return 'Atracción turística';

  // Religión
  if (texto.includes('church') || texto.includes('iglesia') || texto.includes('synagogue') || texto.includes('mosque')) return 'Lugar de culto';

  // Fallback
  return 'Otro';
}

/**
 * Extrae la categoría principal de un array o string de categorías
 * @param {string|array} categories - Categorías (string separado por comas o array)
 * @returns {object} { main: string, raw: string }
 */
function extractMainCategory(categories) {
  if (!categories) {
    return { main: 'Otro', raw: '' };
  }

  let categoriesList = [];
  
  if (typeof categories === 'string') {
    categoriesList = categories
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);
  } else if (Array.isArray(categories)) {
    categoriesList = categories
      .map(c => String(c).trim())
      .filter(c => c.length > 0);
  }

  if (categoriesList.length === 0) {
    return { main: 'Otro', raw: '' };
  }

  // La categoría principal es el resultado de generalizar la primera categoría
  const main = generalizarCategoria(categoriesList[0]);
  
  // Raw categories: todas las categorías originales unidas
  const raw = categoriesList.join(', ');

  return { main, raw };
}

module.exports = {
  generalizarCategoria,
  extractMainCategory,
};
