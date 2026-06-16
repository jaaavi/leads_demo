const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const sharp = require('sharp');
const archiver = require('archiver');
const { analyzeImageForSEO } = require('../services/openaiService');

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'images');
const METADATA_FILE = path.join(UPLOADS_DIR, 'metadata.json');

// Ensure uploads directory exists
async function ensureUploadsDir() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating uploads directory:', err);
  }
}

// Load metadata from file
async function loadMetadata() {
  try {
    if (fsSync.existsSync(METADATA_FILE)) {
      const data = await fs.readFile(METADATA_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Error loading metadata:', err);
  }
  return [];
}

// Save metadata to file
async function saveMetadata(metadata) {
  try {
    await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving metadata:', err);
    throw err;
  }
}

// Make filename unique if it already exists
function makeUniqueFilename(baseName, extension) {
  let finalName = `${baseName}${extension}`;
  let counter = 2;

  while (fsSync.existsSync(path.join(UPLOADS_DIR, finalName))) {
    finalName = `${baseName}_${counter}${extension}`;
    counter += 1;
  }

  return finalName;
}

// Get tools page
async function getToolsPage(req, res) {
  try {
    await ensureUploadsDir();
    const metadata = await loadMetadata();
    res.render('admin/tools', { session: req.session, metadata });
  } catch (err) {
    console.error('Error loading tools page:', err);
    res.status(500).render('admin/tools', { 
      session: req.session, 
      metadata: [],
      error: 'Error al cargar la página de herramientas'
    });
  }
}

// Analyze images
async function analyzeImages(req, res) {
  try {
    await ensureUploadsDir();

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    const results = [];
    const metadata = await loadMetadata();

    for (const file of req.files) {
      try {
        // Read file and convert to base64
        const fileBuffer = await fs.readFile(file.path);
        const base64Image = fileBuffer.toString('base64');

        console.log(`📷 Analyzing image: ${file.originalname}`);

        // Analyze with OpenAI
        const analysis = await analyzeImageForSEO(base64Image);

        // Generate unique filename
        const extension = path.extname(file.originalname);
        const newFilename = makeUniqueFilename(analysis.title, extension);
        const newFilePath = path.join(UPLOADS_DIR, newFilename);

        // Move file from temp location to final location
        await fs.rename(file.path, newFilePath);

        // Create metadata entry
        const metadataEntry = {
          id: Date.now() + Math.random(),
          name: newFilename,
          originalName: file.originalname,
          title: analysis.title,
          description: analysis.description,
          uploadedAt: new Date().toISOString(),
          url: `/static/uploads/images/${newFilename}`
        };

        metadata.push(metadataEntry);
        results.push({
          success: true,
          originalName: file.originalname,
          newName: newFilename,
          title: analysis.title,
          description: analysis.description,
          url: metadataEntry.url
        });

        console.log(`✅ Image processed: ${newFilename}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`❌ Error analyzing ${file.originalname}:`, err.message);

        // Remove temp file if analysis failed
        try {
          await fs.unlink(file.path);
        } catch (unlinkErr) {
          console.warn('Could not delete temp file:', unlinkErr);
        }

        results.push({
          success: false,
          originalName: file.originalname,
          error: err.message
        });
      }
    }

    // Save updated metadata
    await saveMetadata(metadata);

    res.json({
      success: true,
      results,
      totalTokensUsed: 'Check OpenAI dashboard for actual token usage'
    });
  } catch (err) {
    console.error('Error in analyzeImages:', err);
    res.status(500).json({ error: err.message });
  }
}

// Get metadata
async function getMetadata(req, res) {
  try {
    const metadata = await loadMetadata();
    res.json(metadata);
  } catch (err) {
    console.error('Error getting metadata:', err);
    res.status(500).json({ error: err.message });
  }
}

// Delete image
async function deleteImage(req, res) {
  try {
    const { id } = req.params;
    let metadata = await loadMetadata();

    const index = metadata.findIndex(item => item.id == id);
    if (index === -1) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const item = metadata[index];

    // Delete file
    try {
      const filePath = path.join(UPLOADS_DIR, item.name);
      await fs.unlink(filePath);
    } catch (unlinkErr) {
      console.warn('Could not delete file:', unlinkErr);
    }

    // Remove from metadata
    metadata.splice(index, 1);
    await saveMetadata(metadata);

    res.json({ success: true, message: 'Image deleted' });
  } catch (err) {
    console.error('Error deleting image:', err);
    res.status(500).json({ error: err.message });
  }
}

// Download metadata as JSON
async function downloadMetadata(req, res) {
  try {
    const metadata = await loadMetadata();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="imagenes.json"');
    res.send(JSON.stringify(metadata, null, 2));
  } catch (err) {
    console.error('Error downloading metadata:', err);
    res.status(500).json({ error: err.message });
  }
}

// Image conversion: WEBP to PNG
async function convertWebpToPng(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    const outputDir = path.join(__dirname, '..', 'public', 'uploads', 'webp-to-png');
    await fs.mkdir(outputDir, { recursive: true });

    const results = [];

    for (const file of req.files) {
      try {
        if (!file.mimetype.includes('image/webp') && !file.originalname.toLowerCase().endsWith('.webp')) {
          results.push({
            success: false,
            originalName: file.originalname,
            error: 'File is not a WEBP image'
          });
          await fs.unlink(file.path).catch(() => {});
          continue;
        }

        const baseName = path.parse(file.originalname).name;
        const outputPath = path.join(outputDir, `${baseName}.png`);

        await sharp(file.path)
          .png()
          .toFile(outputPath);

        await fs.unlink(file.path);

        results.push({
          success: true,
          originalName: file.originalname,
          newName: `${baseName}.png`,
          url: `/static/uploads/webp-to-png/${baseName}.png`
        });

        console.log(`✅ Converted WEBP to PNG: ${baseName}`);
      } catch (err) {
        console.error(`❌ Error converting ${file.originalname}:`, err.message);
        await fs.unlink(file.path).catch(() => {});

        results.push({
          success: false,
          originalName: file.originalname,
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      results,
      message: `${results.filter(r => r.success).length} images converted successfully`
    });
  } catch (err) {
    console.error('Error in convertWebpToPng:', err);
    res.status(500).json({ error: err.message });
  }
}

// Image conversion: JPG/PNG to WEBP
async function convertToWebp(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    const outputDir = path.join(__dirname, '..', 'public', 'uploads', 'to-webp');
    await fs.mkdir(outputDir, { recursive: true });

    const results = [];

    for (const file of req.files) {
      try {
        const fileName = file.originalname.toLowerCase();
        if (!fileName.endsWith(('.jpg', '.jpeg', '.png')) && !['image/jpeg', 'image/png'].includes(file.mimetype)) {
          results.push({
            success: false,
            originalName: file.originalname,
            error: 'File must be JPG or PNG'
          });
          await fs.unlink(file.path).catch(() => {});
          continue;
        }

        const baseName = path.parse(file.originalname).name;
        const outputPath = path.join(outputDir, `${baseName}.webp`);

        await sharp(file.path)
          .webp({ quality: 80 })
          .toFile(outputPath);

        await fs.unlink(file.path);

        results.push({
          success: true,
          originalName: file.originalname,
          newName: `${baseName}.webp`,
          url: `/static/uploads/to-webp/${baseName}.webp`
        });

        console.log(`✅ Converted to WEBP: ${baseName}`);
      } catch (err) {
        console.error(`❌ Error converting ${file.originalname}:`, err.message);
        await fs.unlink(file.path).catch(() => {});

        results.push({
          success: false,
          originalName: file.originalname,
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      results,
      message: `${results.filter(r => r.success).length} images converted successfully`
    });
  } catch (err) {
    console.error('Error in convertToWebp:', err);
    res.status(500).json({ error: err.message });
  }
}

// Download converted images as ZIP (batch download)
async function downloadConvertedImages(req, res) {
  try {
    const { type } = req.params; // 'webp-to-png' or 'to-webp'
    const downloadDir = path.join(__dirname, '..', 'public', 'uploads', type);

    if (!fsSync.existsSync(downloadDir)) {
      return res.status(404).json({ error: 'No converted images found' });
    }

    const files = await fs.readdir(downloadDir);
    if (files.length === 0) {
      return res.status(404).json({ error: 'No converted images found' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="images.json"');

    const imageList = files.map(file => ({
      name: file,
      url: `/static/uploads/${type}/${file}`,
      size: fsSync.statSync(path.join(downloadDir, file)).size
    }));

    res.send(JSON.stringify(imageList, null, 2));
  } catch (err) {
    console.error('Error downloading images:', err);
    res.status(500).json({ error: err.message });
  }
}

// List converted images
async function listConvertedImages(req, res) {
  try {
    const { type } = req.params;
    const dir = path.join(__dirname, '..', 'public', 'uploads', type);

    await fs.mkdir(dir, { recursive: true });
    const files = await fs.readdir(dir);

    const images = [];
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = await fs.stat(filePath);
      images.push({
        name: file,
        url: `/static/uploads/${type}/${file}`,
        size: stats.size,
        createdAt: stats.birthtimeMs
      });
    }

    res.json({
      type,
      count: images.length,
      images: images.sort((a, b) => b.createdAt - a.createdAt)
    });
  } catch (err) {
    console.error('Error listing converted images:', err);
    res.status(500).json({ error: err.message });
  }
}

// Delete converted image
async function deleteConvertedImage(req, res) {
  try {
    const { type, filename } = req.params;
    const filePath = path.join(__dirname, '..', 'public', 'uploads', type, filename);

    // Prevent directory traversal
    const dir = path.join(__dirname, '..', 'public', 'uploads', type);
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(dir);

    if (!resolvedPath.startsWith(resolvedDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (fsSync.existsSync(filePath)) {
      await fs.unlink(filePath);
      res.json({ success: true, message: 'Image deleted' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    console.error('Error deleting converted image:', err);
    res.status(500).json({ error: err.message });
  }
}

// Download converted images as ZIP
async function downloadConvertedImagesAsZip(req, res) {
  try {
    const { type } = req.params;
    const dir = path.join(__dirname, '..', 'public', 'uploads', type);

    // Validate type to prevent directory traversal
    if (!['webp-to-png', 'to-webp'].includes(type)) {
      return res.status(400).json({ error: 'Invalid conversion type' });
    }

    // Check if directory exists
    if (!fsSync.existsSync(dir)) {
      return res.status(404).json({ error: 'No converted images found' });
    }

    // Get list of files
    const files = await fs.readdir(dir);

    if (files.length === 0) {
      return res.status(404).json({ error: 'No converted images found' });
    }

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Set response headers for ZIP download
    const timestamp = new Date().toISOString().split('T')[0];
    const zipFilename = `convertidas-${type}-${timestamp}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    // Pipe archive to response
    archive.pipe(res);

    // Add files to archive
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = await fs.stat(filePath);

      // Only add files, not directories
      if (stats.isFile()) {
        archive.file(filePath, { name: file });
      }
    }

    // Finalize archive
    await archive.finalize();
  } catch (err) {
    console.error('Error downloading converted images as ZIP:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
}

// Download single analyzed image
async function downloadAnalyzedImage(req, res) {
  try {
    const { filename } = req.params;
    const filePath = path.join(UPLOADS_DIR, filename);

    // Prevent directory traversal
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(UPLOADS_DIR);

    if (!resolvedPath.startsWith(resolvedDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath);
  } catch (err) {
    console.error('Error downloading analyzed image:', err);
    res.status(500).json({ error: err.message });
  }
}

// Download all analyzed images as ZIP
async function downloadAnalyzedImagesAsZip(req, res) {
  try {
    if (!fsSync.existsSync(UPLOADS_DIR)) {
      return res.status(404).json({ error: 'No analyzed images found' });
    }

    const files = await fs.readdir(UPLOADS_DIR);

    if (files.length === 0) {
      return res.status(404).json({ error: 'No analyzed images found' });
    }

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Set response headers for ZIP download
    const timestamp = new Date().toISOString().split('T')[0];
    const zipFilename = `imagenes-analizadas-${timestamp}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    // Pipe archive to response
    archive.pipe(res);

    // Add files to archive
    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file);
      const stats = await fs.stat(filePath);

      // Only add files, not directories (exclude metadata.json)
      if (stats.isFile() && file !== 'metadata.json') {
        archive.file(filePath, { name: file });
      }
    }

    // Finalize archive
    await archive.finalize();
  } catch (err) {
    console.error('Error downloading analyzed images as ZIP:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
}

module.exports = {
  getToolsPage,
  analyzeImages,
  getMetadata,
  deleteImage,
  downloadMetadata,
  downloadAnalyzedImage,
  downloadAnalyzedImagesAsZip,
  convertWebpToPng,
  convertToWebp,
  downloadConvertedImages,
  listConvertedImages,
  deleteConvertedImage,
  downloadConvertedImagesAsZip
};
