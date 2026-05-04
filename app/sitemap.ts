export default function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;

  return [
    { url: baseUrl, lastModified: new Date() },
    { url: `${baseUrl}/pricing`, lastModified: new Date() },
    { url: `${baseUrl}/wireless-sales-interview-screening`, lastModified: new Date() },
    { url: `${baseUrl}/wireless-customer-service-screening`, lastModified: new Date() },
    { url: `${baseUrl}/ai-sales-interview-tool`, lastModified: new Date() },
    { url: `${baseUrl}/telecom-hiring-software`, lastModified: new Date() },
  ];
}
