# Admin Tools

This document describes the admin tools from the production-style application.

In the public demo, these tools are presented as UI and mocked endpoints. They do not call OpenAI, process real uploads, or require external credentials.

## Tools Overview

The admin tools section includes:

1. AI image analyzer.
2. Metadata browser.
3. WEBP to PNG converter.
4. JPG/PNG to WEBP converter.

Route:

```text
/admin/tools
```

Access:

```text
admin role only
```

## AI Image Analyzer

Production-style purpose:

- Analyze uploaded images.
- Generate SEO-friendly file titles.
- Generate professional descriptions.
- Rename files.
- Store metadata as JSON.

Production-style environment variable:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o
```

The public demo does not use these variables.

## Supported Upload Rules

Production-style limits:

- Formats: JPG, JPEG, PNG, WebP.
- Max size: 10 MB per image.
- Max batch: 20 images for AI analysis.
- Max batch: 50 images for format conversion.

## Metadata Structure

Example production-style metadata:

```json
[
  {
    "id": 1731698123456.123,
    "name": "local_business_interior_warm_lighting.jpg",
    "originalName": "IMG_2024.jpg",
    "title": "local_business_interior_warm_lighting",
    "description": "Interior photo of a local business with warm lighting.",
    "uploadedAt": "2024-11-15T17:48:43.456Z",
    "url": "/static/uploads/images/local_business_interior_warm_lighting.jpg"
  }
]
```

## Title Generation Rules

Generated SEO titles should:

1. Use lowercase slug format.
2. Avoid spaces.
3. Avoid generic words such as `image`, `photo`, or `pic`.
4. Combine business context, visible subject, and a distinguishing detail.
5. Stay unique within the project.

## WEBP to PNG

Production-style behavior:

- Input: WEBP.
- Output: PNG.
- Purpose: convert web images into a standard format.
- Quality: lossless.

## JPG/PNG to WEBP

Production-style behavior:

- Input: JPG, JPEG, PNG.
- Output: WEBP.
- Purpose: optimize images for the web.
- Quality target: 80.

## Folder Structure

Production-style upload folders:

```text
public/
└── uploads/
    ├── images/
    │   └── metadata.json
    ├── webp-to-png/
    ├── to-webp/
    └── temp/
```

## Public Demo Behavior

In the demo:

- Upload endpoints return mocked responses.
- No files are processed.
- No OpenAI calls are made.
- No external storage is required.
- The UI remains visible to show the product scope.

## Security Notes for Production

For a private production deployment:

- Validate file types.
- Enforce file-size limits.
- Clean temporary files.
- Keep API keys in `.env`.
- Restrict tools to admins.
- Monitor OpenAI token usage.
