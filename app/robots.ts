import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://limbus.haneuk.info'
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dante/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}

