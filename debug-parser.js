const axios = require('axios');
const cheerio = require('cheerio');

async function debugGoogleMapsParser() {
    const url = 'https://www.google.com/maps/place/Canada%27s+Wonderland/@43.8423619,-79.5437904,791m/data=!3m2!1e3!4b1!4m6!3m5!1s0x882b2f4b21b97b7b:0x87a6830532b2fcfc!8m2!3d43.8423619!4d-79.5412155!16zL20vMDJoNDU2?entry=ttu&g_ep=EgoyMDI1MDYxNy4wIKXMDSoASAFQAw%3D%3D';

    try {
        console.log('Debug: Testing Google Maps parser with enhanced debugging...');
        console.log('URL:', url);
        console.log('');

        // Scrape the page
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);

        console.log('=== EXTRACTED OPEN GRAPH DATA ===');
        const ogData = {};
        $('meta[property^="og:"]').each(function () {
            const property = $(this).attr('property');
            const content = $(this).attr('content');
            if (property && content) {
                const key = property.replace('og:', '');
                ogData[key] = content;
                console.log(`${property}: ${content}`);
            }
        });

        console.log('');
        console.log('=== URL INFO EXTRACTION ===');

        // Extract from URL
        const placeMatch = url.match(/\/place\/([^\/]+)/);
        const placeName = placeMatch ? decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ') : null;
        console.log('Place name from URL:', placeName);

        const coordsMatch = url.match(/@([0-9.-]+),([0-9.-]+)/);
        const coordinates = coordsMatch ? {
            lat: parseFloat(coordsMatch[1]),
            lng: parseFloat(coordsMatch[2])
        } : null;
        console.log('Coordinates from URL:', coordinates);

        console.log('');
        console.log('=== SCRAPING LOGIC DEBUGGING ===');

        let scrapedInfo = {};

        // Use Open Graph title as primary source
        scrapedInfo.title = ogData.title || placeName || $('title').text().replace(' - Google Maps', '').trim();
        console.log('Final title:', scrapedInfo.title);

        // Extract description from Open Graph or meta description
        scrapedInfo.description = ogData.description || $('meta[name="description"]').attr('content') || '';
        console.log('Initial description:', scrapedInfo.description);

        // Extract address from meta name tag (format: "Place Name · Address")
        const nameContent = $('meta[name="name"]').attr('content') || '';
        console.log('Meta name content:', nameContent);

        if (nameContent && nameContent.includes('·')) {
            const parts = nameContent.split('·');
            if (parts.length > 1) {
                scrapedInfo.address = parts[1].trim();
                console.log('Address from meta name:', scrapedInfo.address);
                // If we don't have a title yet, use the first part
                if (!scrapedInfo.title || scrapedInfo.title === 'Google Maps') {
                    scrapedInfo.title = parts[0].trim();
                    console.log('Updated title from meta name:', scrapedInfo.title);
                }
            }
        }

        // Extract rating and business type from description
        if (scrapedInfo.description) {
            // Rating extraction (★★★★☆ format or numeric)
            const ratingMatch = scrapedInfo.description.match(/★+\s*(\d+[.,]\d+|\d+)/);
            console.log('Rating match:', ratingMatch);
            if (ratingMatch) {
                const stars = (scrapedInfo.description.match(/★/g) || []).length;
                const numRating = ratingMatch[1] ? parseFloat(ratingMatch[1].replace(',', '.')) : stars;
                scrapedInfo.rating = Math.min(numRating, 5); // Cap at 5 stars
                console.log('Extracted rating:', scrapedInfo.rating, '(stars count:', stars, ')');
            } else {
                scrapedInfo.rating = 0;
                console.log('No rating found');
            }

            // Business type extraction (after the rating)
            const businessTypeMatch = scrapedInfo.description.match(/★+.*?·\s*(.+)$/);
            console.log('Business type match:', businessTypeMatch);
            if (businessTypeMatch) {
                scrapedInfo.businessType = businessTypeMatch[1].trim();
                console.log('Extracted business type:', scrapedInfo.businessType);
            }
        } else {
            scrapedInfo.rating = 0;
            console.log('No description found for rating/business type extraction');
        }

        // Extract and process image
        if (ogData.image) {
            let imageUrl = ogData.image;
            console.log('Original OG image:', imageUrl);
            // Enhance Google's image quality
            if (imageUrl.includes('googleusercontent.com')) {
                imageUrl = imageUrl.replace(/=w\d+-h\d+-p-k-no/, '=w1200-h630-p-k-no');
                imageUrl = imageUrl.replace(/=s\d+/, '=s1200');
                console.log('Enhanced image URL:', imageUrl);
            }
            scrapedInfo.image = imageUrl;
        }

        console.log('');
        console.log('=== FINAL SCRAPED INFO ===');
        console.log(JSON.stringify(scrapedInfo, null, 2));

        console.log('');
        console.log('=== WHAT DISCORD WOULD SHOW ===');
        console.log(`🏢 Title: ${scrapedInfo.title || 'N/A'}`);
        console.log(`📍 Address: ${scrapedInfo.address || 'N/A'}`);
        console.log(`🏷️ Business Type: ${scrapedInfo.businessType || 'N/A'}`);
        console.log(`⭐ Rating: ${scrapedInfo.rating || 'N/A'} ${scrapedInfo.rating ? 'stars' : ''}`);
        console.log(`📝 Description: ${scrapedInfo.description || 'N/A'}`);
        console.log(`🖼️ Image: ${scrapedInfo.image ? 'Available' : 'N/A'}`);
        if (coordinates) console.log(`🌐 Coordinates: ${coordinates.lat}, ${coordinates.lng}`);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugGoogleMapsParser();
