const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');

// Parse URL to extract activity information
router.post('/', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  console.log('=== MAIN ROUTER DEBUG ===');
  console.log('Received URL type:', typeof url);
  console.log('Received URL length:', url?.length);
  console.log('Received URL (first 100 chars):', url?.substring(0, 100));
  console.log('==========================');

  try {
    // Validate URL
    let resolvedUrl = url;
    const urlObj = new URL(url);

    // Check if it's a Google Maps shortened URL that needs to be resolved
    if (urlObj.hostname.includes('g.co') && urlObj.pathname.includes('/kgs/')) {
      try {
        resolvedUrl = await resolveRedirect(url);
        console.log(`Resolved shortened URL ${url} to ${resolvedUrl}`);
      } catch (redirectError) {
        console.error('Failed to resolve shortened URL:', redirectError.message);
        // Continue with original URL if resolution fails
      }
    }    // Re-parse the resolved URL
    const resolvedUrlObj = new URL(resolvedUrl);

    // Check if it's a Google Maps link or Google Search
    if (resolvedUrlObj.hostname.includes('google.com') &&
      (resolvedUrlObj.pathname.includes('/maps') || resolvedUrlObj.pathname.includes('/search')) ||
      resolvedUrlObj.hostname.includes('maps.google') || resolvedUrlObj.hostname.includes('goo.gl') ||
      resolvedUrlObj.hostname.includes('maps.app.goo.gl') ||
      (urlObj.hostname.includes('g.co') && urlObj.pathname.includes('/kgs/'))) {
      return await parseGoogleMapsUrl(resolvedUrl, res);
    }// Check if it's an Apple Maps link
    if (resolvedUrlObj.hostname.includes('maps.apple.com')) {
      return await parseAppleMapsUrl(resolvedUrl, res);
    }

    // Check if it's an Instagram link
    if (resolvedUrlObj.hostname.includes('instagram.com') || resolvedUrlObj.hostname.includes('instagr.am')) {
      return await parseInstagramUrl(resolvedUrl, res);
    }

    // Check if it's a Yelp link
    if (resolvedUrlObj.hostname.includes('yelp.com')) {
      return await parseYelpUrl(resolvedUrl, res);
    }

    // Check if it's a TripAdvisor link
    if (resolvedUrlObj.hostname.includes('tripadvisor.com')) {
      return await parseTripAdvisorUrl(resolvedUrl, res);
    }

    // Generic web page parsing
    return await parseGenericUrl(resolvedUrl, res);
  } catch (error) {
    console.error('Error parsing URL:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to parse URL',
      details: error.message,
      stack: error.stack
    });
  }
});

// Function to resolve redirected URLs (for shortened Google Maps links)
async function resolveRedirect(url) {
  try {
    const response = await axios.get(url, {
      maxRedirects: 5,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    return response.request.res.responseUrl || response.config.url || url;
  } catch (error) {
    console.error('Error resolving redirect:', error.message);
    throw error;
  }
}

async function parseGoogleMapsUrl(url, res) {
  try {
    console.log('=== Starting Google Maps URL parsing ===');
    console.log('URL:', url);

    // First, try to extract information from the URL itself
    console.log('Step 1: Extracting from URL...');
    const urlInfo = extractFromGoogleMapsUrl(url);
    console.log('URL info:', urlInfo);    // Then try to scrape the page for additional details
    let scrapedInfo = {};
    let ogData = {}; // Initialize ogData outside try block
    try {
      console.log('Step 2: Starting HTTP request...');
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      console.log('HTTP response status:', response.status);
      console.log('Step 3: Loading HTML with Cheerio...');
      const $ = cheerio.load(response.data);

      console.log('Step 4: Extracting Open Graph data...');
      // Extract Open Graph data (Discord's primary method)
      ogData = extractOpenGraphData($);
      console.log('Open Graph data found:', Object.keys(ogData).length > 0);

      // Use Open Graph title as primary source
      scrapedInfo.title = ogData.title || urlInfo.placeName || $('title').text().replace(' - Google Maps', '').trim();

      // Extract description from Open Graph or meta description
      scrapedInfo.description = ogData.description || $('meta[name="description"]').attr('content') || '';
      // Extract address from meta name tag (format: "Place Name · Address")
      const nameContent = $('meta[name="name"]').attr('content') || '';
      if (nameContent && nameContent.includes('·')) {
        const parts = nameContent.split('·');
        if (parts.length > 1) {
          scrapedInfo.address = parts[1].trim();
          // If we don't have a title yet, use the first part
          if (!scrapedInfo.title || scrapedInfo.title === 'Google Maps') {
            scrapedInfo.title = parts[0].trim();
          }
        }
      }

      // Also try to extract address from the OG title if it has the same format
      if (!scrapedInfo.address && ogData.title && ogData.title.includes('·')) {
        const parts = ogData.title.split('·');
        if (parts.length > 1) {
          scrapedInfo.address = parts[1].trim();
          // Update title to be just the place name
          scrapedInfo.title = parts[0].trim();
        }
      }

      // Extract rating and business type from description
      if (scrapedInfo.description) {
        // Rating extraction - count the star symbols and look for numeric rating
        const starCount = (scrapedInfo.description.match(/★/g) || []).length;
        const emptyStarCount = (scrapedInfo.description.match(/☆/g) || []).length;

        if (starCount > 0) {
          // Use star count as rating (out of 5)
          scrapedInfo.rating = starCount;
        } else {
          // Try to find numeric rating
          const ratingMatch = scrapedInfo.description.match(/(\d+[.,]\d+)/);
          if (ratingMatch) {
            scrapedInfo.rating = Math.min(parseFloat(ratingMatch[1].replace(',', '.')), 5);
          } else {
            scrapedInfo.rating = 0;
          }
        }

        // Business type extraction (after the rating symbols)
        const businessTypeMatch = scrapedInfo.description.match(/[★☆]+\s*·\s*(.+)$/);
        if (businessTypeMatch) {
          scrapedInfo.businessType = businessTypeMatch[1].trim();
        }
      } else {
        scrapedInfo.rating = 0;
      }

      // Extract and process image
      if (ogData.image) {
        let imageUrl = ogData.image;
        // Enhance Google's image quality
        if (imageUrl.includes('googleusercontent.com')) {
          imageUrl = imageUrl.replace(/=w\d+-h\d+-p-k-no/, '=w1200-h630-p-k-no');
          imageUrl = imageUrl.replace(/=s\d+/, '=s1200');
        }
        scrapedInfo.image = imageUrl;
      }

      // Check if this is a Google Search page for fallback parsing
      const isSearchPage = url.includes('/search');

      if (isSearchPage) {
        // For Google Search pages, try to extract information from search results
        if (!scrapedInfo.title || scrapedInfo.title === 'Google Maps') {
          scrapedInfo.title = $('h3').first().text().trim() ||
            $('.LC20lb').first().text().trim() ||
            $('.DKV0Md').first().text().trim() ||
            urlInfo.placeName;
        }

        // Try to extract business information from knowledge panel
        if (!scrapedInfo.address) {
          scrapedInfo.address = $('[data-attrid="kc:/location/location:address"]').text().trim() ||
            $('[data-attrid="wa:/description"]').text().trim() ||
            $('.LrzXr').text().trim();
        }

        // Extract rating from knowledge panel if not found
        if (!scrapedInfo.rating) {
          const searchRatingText = $('[data-attrid="kc:/ugc:rating"]').text().trim() ||
            $('span[aria-label*="star"]').attr('aria-label') ||
            $('.Aq14fc').text().trim();

          if (searchRatingText) {
            const searchRatingMatch = searchRatingText.match(/(\d+[.,]\d+)/);
            if (searchRatingMatch) {
              scrapedInfo.rating = parseFloat(searchRatingMatch[1].replace(',', '.'));
            }
          }
        }

        // Try to extract business type from search results if not found
        if (!scrapedInfo.businessType) {
          scrapedInfo.businessType = $('[data-attrid="kc:/organization/organization:type"]').text().trim() ||
            $('.wwUB2c').text().trim() ||
            $('.YhemCb').text().trim();
        }

      } else {
        // Enhanced Google Maps parsing logic for fallback
        if (!scrapedInfo.title || scrapedInfo.title === 'Google Maps') {
          scrapedInfo.title = $('h1[data-value="title"]').text().trim() ||
            $('h1').first().text().trim() ||
            $('[data-attrid="title"]').text().trim() ||
            $('[role="main"] h1').text().trim() ||
            urlInfo.placeName;
        }

        // Extract address with multiple selectors if not found
        if (!scrapedInfo.address) {
          scrapedInfo.address = $('[data-value="address"]').text().trim() ||
            $('[data-item-id="address"]').text().trim() ||
            $('[data-attrid="kc:/location/location:address"]').text().trim() ||
            $('span[jsan]').filter(function () {
              return $(this).text().match(/\d+.*[A-Z]{2}\s+\d{5}/);
            }).first().text().trim();
        }

        // Extract rating with improved selectors if not found
        if (!scrapedInfo.rating) {
          const ratingText = $('[data-value="rating"]').text().trim() ||
            $('span[aria-label*="star"]').attr('aria-label') ||
            $('[jsaction*="review"] span').filter(function () {
              return $(this).text().match(/^\d+[.,]\d+$/);
            }).first().text().trim() ||
            $('span').filter(function () {
              return $(this).text().match(/^\d+[.,]\d+$/) &&
                parseFloat($(this).text().replace(',', '.')) <= 5;
            }).first().text().trim() ||
            $('[role="img"][aria-label*="star"]').attr('aria-label');

          if (ratingText) {
            // Handle different rating formats
            const ratingMatch = ratingText.match(/(\d+[.,]\d+)/);
            if (ratingMatch) {
              scrapedInfo.rating = parseFloat(ratingMatch[1].replace(',', '.'));
            } else {
              // Try to extract from aria-label like "4.5 stars"
              const starsMatch = ratingText.match(/(\d+[.,]\d+)\s*star/i);
              if (starsMatch) {
                scrapedInfo.rating = parseFloat(starsMatch[1].replace(',', '.'));
              } else {
                scrapedInfo.rating = 0;
              }
            }
          } else {
            scrapedInfo.rating = 0;
          }
        }

        // Try to extract business type/category if not found
        if (!scrapedInfo.businessType) {
          scrapedInfo.businessType = $('[data-value="category"]').text().trim() ||
            $('button[data-value="category"]').text().trim() ||
            $('.section-result-text-buttons button').first().text().trim();
        }
      }

      // Try to extract description/snippet if not found in OG data
      if (!scrapedInfo.description) {
        scrapedInfo.description = $('[data-attrid="description"]').text().trim() ||
          $('[jsaction*="description"]').text().trim() ||
          $('.section-result-details').text().trim() ||
          $('[data-value="snippet"]').text().trim() ||
          $('span[jsan] span').filter(function () {
            const text = $(this).text().trim();
            return text.length > 50 && text.length < 300 && !text.match(/^\d+/);
          }).first().text().trim();
      }

      // Extract hours if available
      scrapedInfo.hours = $('[data-attrid="kc:/location/location:hours"]').text().trim() ||
        $('[aria-label*="Hours"]').text().trim();

      // Extract phone number
      scrapedInfo.phone = $('[data-attrid="kc:/location/location:phone"]').text().trim() ||
        $('a[href^="tel:"]').text().trim();      // Try to extract images from Google Maps with enhanced selectors
      scrapedInfo.image =
        // First try Open Graph image (Discord's primary method)
        $('meta[property="og:image"]').attr('content') ||
        $('meta[property="og:image:url"]').attr('content') ||

        // Try Google Maps specific image selectors
        $('[data-attrid="kc:/location/location:media"] img').first().attr('src') ||
        $('img[src*="streetviewpixels"]').first().attr('src') ||
        $('img[src*="maps.googleapis.com"]').first().attr('src') ||
        $('img[src*="googleusercontent.com"]').first().attr('src') ||

        // Business photos from Maps
        $('[data-photo-index] img').first().attr('src') ||
        $('img[alt*="Photo"], img[alt*="Image"]').first().attr('src') ||
        $('[jsaction*="photo"] img').first().attr('src') ||

        // Fallback to any image that looks like a place photo
        $('img[src*="lh3.googleusercontent.com"]').first().attr('src') ||
        $('img[src*="lh5.googleusercontent.com"]').first().attr('src') ||

        null;      // Only extract additional address info if we don't already have one from OG data
      if (!scrapedInfo.address) {
        scrapedInfo.address =
          // Open Graph and structured data
          $('meta[property="og:street-address"]').attr('content') ||
          $('[itemprop="streetAddress"]').text().trim() ||

          // Google Maps specific selectors
          $('[data-value="address"]').text().trim() ||
          $('[data-item-id="address"]').text().trim() ||
          $('[data-attrid="kc:/location/location:address"]').text().trim() ||
          $('[aria-label*="Address"]').text().trim() ||

          // Look for address patterns in text content
          $('span[jsan]').filter(function () {
            const text = $(this).text();
            return text.match(/\d+.*[A-Z]{2}\s+\d{5}/) || // US format
              text.match(/\d+.*[A-Z]\d[A-Z]\s*\d[A-Z]\d/) || // Canadian postal code
              text.match(/\d+.*\w+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)/i);
          }).first().text().trim() ||

          // Fallback patterns
          $('.section-result-content span').filter(function () {
            return $(this).text().length > 10 && $(this).text().includes(',');
          }).first().text().trim();
      }

      scrapedInfo.phone = $('[data-attrid="kc:/location/location:phone"]').text().trim() ||
        $('a[href^="tel:"]').text().trim();
    } catch (scrapeError) {
      console.log('Scraping failed, using URL extraction only:', scrapeError.message);
      console.log('Stack trace:', scrapeError.stack);
    }// Combine URL extraction with scraped data, prioritizing URL extraction for title if it's meaningful
    // Only use scraped title if URL extraction didn't find a place name or if scraped title is more specific
    const title = (urlInfo.placeName && !scrapedInfo.title?.includes('Google Maps')) ?
      urlInfo.placeName :
      (scrapedInfo.title && !scrapedInfo.title.includes('Google Maps')) ?
        scrapedInfo.title :
        urlInfo.placeName ||
        'Location from Google Maps';    // Prioritize scraped address over URL extraction    
    const address = scrapedInfo.address || urlInfo.address || 'See Google Maps link';
    const rating = scrapedInfo.rating || 0;
    // Convert rating to excitement (1-5 scale to 1-10 scale)
    const excitement = rating > 0 ? Math.round(rating * 2) : 0;
    const businessType = scrapedInfo.businessType || '';

    // Extract category
    const category = determineCategory(title, address + ' ' + businessType);

    // Create a better description using the extracted data
    let description = '';
    if (scrapedInfo.description && scrapedInfo.description.length > 20 && !scrapedInfo.description.includes('Find local businesses')) {
      description = scrapedInfo.description;    } else if (businessType && excitement > 0) {
      description = `${businessType} • Excitement level: ${excitement}/10`;
    } else if (businessType && rating > 0) {
      description = `${businessType} • ${rating} star rating (Excitement: ${excitement}/10)`;
    } else if (businessType && address && address !== 'See Google Maps link') {
      description = `${businessType} located at ${address}`;
    } else if (businessType) {
      description = `${businessType} - Location found on Google Maps`;
    } else if (address && address !== 'See Google Maps link') {
      description = `Location at ${address}`;
    } else {
      description = 'Location found on Google Maps';
    }

    // Add additional info if available
    if (scrapedInfo.hours && scrapedInfo.hours.length < 100 && scrapedInfo.hours.length > 5) {
      description += ` • ${scrapedInfo.hours}`;
    }    // Process the image URL using Discord-style enhancement
    const processedImageUrl = processImageUrl(scrapedInfo.image, title, address);

    const result = {
      title: title,
      description: description,
      category: category,
      location: address,
      url: url,
      image_url: processedImageUrl,      estimated_cost: estimateCostByCategory(category),
      excitement: excitement,
      duration: estimateDurationByCategory(category),
      // Add metadata for debugging and frontend display
      _metadata: {
        source: 'google_maps',
        businessType: businessType,
        hasOpenGraph: !!ogData.title,
        imageSource: scrapedInfo.image ? 'scraped' : 'none',
        addressMethod: scrapedInfo.address ? 'scraped' : 'url_extracted',
        extractedData: {
          ogTitle: scrapedInfo.title,
          ogDescription: scrapedInfo.description,
          ogImage: scrapedInfo.image,
          scrapedAddress: scrapedInfo.address,
          scrapedRating: scrapedInfo.rating,
          scrapedBusinessType: scrapedInfo.businessType
        }
      }
    };

    console.log('Step 5: Final result created successfully');
    res.json(result);
  } catch (error) {
    console.error('Error parsing Google Maps URL:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to parse Google Maps URL',
      details: error.message,
      stack: error.stack
    });
  }
}

function extractFromGoogleMapsUrl(url) {
  const result = {
    placeName: null,
    address: null,
    coordinates: null
  };

  try {
    const urlObj = new URL(url);

    // Handle Google Search URLs
    if (urlObj.pathname.includes('/search')) {
      const params = urlObj.searchParams;
      const query = params.get('q');
      if (query) {
        result.placeName = query.replace(/\+/g, ' ').trim();
        return result;
      }
    }

    // Handle different Google Maps URL formats
    // Format 1: /maps/place/Place+Name/@lat,lng,zoom
    const placeMatch = url.match(/\/maps\/place\/([^\/\@]+)/);
    if (placeMatch) {
      result.placeName = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
    }
    // Format 2: /maps/search/query
    const searchMatch = url.match(/\/maps\/search\/([^\/\@]+)/);
    if (searchMatch) {
      result.placeName = decodeURIComponent(searchMatch[1]).replace(/\+/g, ' ');
    }

    // Format 3: Check URL parameters
    const params = urlObj.searchParams;
    const query = params.get('q');
    if (query) {
      result.placeName = query;
    }
    // Format 4: Extract from coordinates and location name
    const pathParts = urlObj.pathname.split('/');
    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i] === 'place' && pathParts[i + 1]) {
        const placePart = pathParts[i + 1];
        // Stop at @ symbol which indicates coordinates
        const atIndex = placePart.indexOf('@');
        const cleanPlaceName = atIndex > -1 ? placePart.substring(0, atIndex) : placePart;
        result.placeName = decodeURIComponent(cleanPlaceName).replace(/\+/g, ' ');
        break;
      }
    }    // Clean up the place name and try to extract address
    if (result.placeName) {
      // Remove common suffixes and clean up
      result.placeName = result.placeName
        .replace(/@.*$/, '')      // Remove @coordinates and everything after
        .replace(/\+/g, ' ')      // Replace + with spaces
        .replace(/,$/, '')        // Remove trailing comma
        .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
        .trim();

      // Try to extract address from place name if it contains address components
      // Look for patterns like "Business Name, 123 Street Name, City, State"
      const addressPattern = /,\s*(\d+[^,]*(?:st|nd|rd|th|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|way|lane|ln|ct|court|pl|place)[^,]*(?:,\s*[^,]+)*)/i;
      const addressMatch = result.placeName.match(addressPattern);
      if (addressMatch) {
        result.address = addressMatch[1].trim();
        // Clean up the place name to remove the address part
        result.placeName = result.placeName.replace(addressPattern, '').replace(/,\s*$/, '').trim();
      }
    }

    // Extract coordinates if present
    const coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (coordMatch) {
      result.coordinates = {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2])
      };
    }

  } catch (error) {
    console.log('Error extracting from URL:', error.message);
  }
  return result;
}

async function parseAppleMapsUrl(url, res) {
  try {
    // Extract information from Apple Maps URL
    const urlObj = new URL(url);
    let placeName = null;
    let address = null;

    // Apple Maps URL format: https://maps.apple.com/?q=Place+Name or with parameters
    const params = urlObj.searchParams;
    const query = params.get('q');
    const place = params.get('place');
    const ll = params.get('ll'); // latitude,longitude

    if (query) {
      placeName = decodeURIComponent(query).replace(/\+/g, ' ');
    } else if (place) {
      placeName = decodeURIComponent(place).replace(/\+/g, ' ');
    }

    // Clean up place name
    if (placeName) {
      placeName = placeName.trim();
      // Remove coordinates if they're part of the name
      placeName = placeName.replace(/,?\s*[-\d]+\.?\d*,\s*[-\d]+\.?\d*$/, '');
    }

    const title = placeName || 'Location from Apple Maps';
    const category = determineCategory(title, '');    const result = {
      title: title,
      description: `Location found on Apple Maps${ll ? ' (coordinates: ' + ll + ')' : ''}`,
      category: category,
      location: address || 'See Apple Maps link',
      url: url,
      image_url: null,
      estimated_cost: estimateCostByCategory(category),
      excitement: 0,
      duration: estimateDurationByCategory(category)
    };

    res.json(result);
  } catch (error) {
    console.error('Error parsing Apple Maps URL:', error);
    res.status(500).json({ error: 'Failed to parse Apple Maps URL' });
  }
}

async function parseYelpUrl(url, res) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    // Try multiple selectors for business name
    const title = $('h1[data-font-weight="semibold"]').text().trim() ||
      $('h1').first().text().trim() ||
      $('.biz-page-title').text().trim() ||
      $('[data-testid="business-name"]').text().trim() ||
      'Yelp Business';    // Extract rating with multiple selectors
    const ratingElement = $('.i-stars').attr('title') ||
      $('.rating-large').attr('aria-label') ||
      $('[data-testid="rating"]').text().trim();
    const rating = ratingElement ? parseFloat(ratingElement.match(/(\d+\.?\d*)/)?.[1] || '0') : 0;
    // Convert rating to excitement (1-5 scale to 1-10 scale)
    const excitement = rating > 0 ? Math.round(rating * 2) : 0;

    // Extract address with multiple selectors
    const address = $('.street-address').text().trim() + ' ' +
      $('.locality').text().trim() + ' ' +
      $('.region').text().trim() ||
      $('.address').text().trim() ||
      $('[data-testid="business-address"]').text().trim();

    // Extract price range
    const priceRange = $('.price-range').text().trim() ||
      $('[data-testid="price-range"]').text().trim() ||
      $('.business-attribute-price-range').text().trim();

    // Extract category with multiple selectors  
    const category = $('.category-str-list a').first().text().trim() ||
      $('[data-testid="business-categories"] a').first().text().trim() ||
      $('.business-categories a').first().text().trim() ||
      'Food & Dining';    // Extract image with multiple selectors
    const imageUrl = $('.photo-box img').first().attr('src') ||
      $('[data-testid="business-photo"] img').attr('src') ||
      $('.js-business-photo img').first().attr('src') ||
      $('.media-landing-map img').first().attr('src') ||
      $('.photo-carousel img').first().attr('src') ||
      $('[data-photo-index] img').first().attr('src') ||
      $('.photos img').first().attr('src') ||
      $('img[src*="yelp"]').filter(function () {
        const src = $(this).attr('src');
        return src && (src.includes('.jpg') || src.includes('.jpeg') || src.includes('.png') || src.includes('.webp')) &&
          !src.includes('icon') && !src.includes('logo') && !src.includes('avatar');
      }).first().attr('src');

    // Estimate cost based on price range
    let estimatedCost = estimateCostByCategory(determineCategory(title, category));
    if (priceRange.includes('$$$$')) estimatedCost = Math.max(estimatedCost, 100);
    else if (priceRange.includes('$$$')) estimatedCost = Math.max(estimatedCost, 60);
    else if (priceRange.includes('$$')) estimatedCost = Math.max(estimatedCost, 30);
    else if (priceRange.includes('$')) estimatedCost = Math.min(estimatedCost, 25);

    const determinedCategory = determineCategory(title, category);    const result = {
      title: title,
      description: `${category} found on Yelp${address ? ' - ' + address.trim() : ''}`,
      category: determinedCategory,
      location: address ? address.trim() : 'See Yelp page for details',
      url: url,
      image_url: imageUrl,
      estimated_cost: estimatedCost,
      excitement: excitement,
      duration: estimateDurationByCategory(determinedCategory)
    };

    res.json(result);
  } catch (error) {
    console.error('Error parsing Yelp URL:', error);
    res.status(500).json({ error: 'Failed to parse Yelp URL' });
  }
}

async function parseTripAdvisorUrl(url, res) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    // Try multiple selectors for title
    const title = $('h1[data-automation="mainH1"]').text().trim() ||
      $('h1').first().text().trim() ||
      $('.ui_header h1').text().trim() ||
      $('.heading_title').text().trim() ||
      'TripAdvisor Activity';    // Extract rating
    const ratingElement = $('.overallRating').text().trim() ||
      $('[data-automation="rating"]').text().trim() ||
      $('.ui_bubble_rating').attr('class');
    let rating = 0;
    if (ratingElement) {
      const ratingMatch = ratingElement.match(/(\d+\.?\d*)/);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1]);
      } else if (ratingElement.includes('bubble_')) {
        // Handle bubble rating format (bubble_50 = 5.0, bubble_45 = 4.5, etc.)
        const bubbleMatch = ratingElement.match(/bubble_(\d+)/);
        if (bubbleMatch) {
          rating = parseInt(bubbleMatch[1]) / 10;
        }
      }
    }
    // Convert rating to excitement (1-5 scale to 1-10 scale)
    const excitement = rating > 0 ? Math.round(rating * 2) : 0;

    // Extract address
    const address = $('.format_address').text().trim() ||
      $('[data-automation="address"]').text().trim() ||
      $('.address').text().trim();

    // Extract description
    const description = $('.partial_entry').text().trim() ||
      $('[data-automation="reviewText"]').first().text().trim().substring(0, 200) ||
      $('.review-text').first().text().trim().substring(0, 200);

    // Extract category/type
    const activityType = $('.ui_breadcrumbs a').last().text().trim() ||
      $('.breadcrumbs a').last().text().trim() ||
      'Activity';

    const determinedCategory = determineCategory(title, activityType + ' ' + description);    const result = {
      title: title,
      description: description || `${activityType} found on TripAdvisor${address ? ' - ' + address : ''}`,
      category: determinedCategory,
      location: address || 'See TripAdvisor page for details',
      url: url,
      image_url: null,
      estimated_cost: estimateCostByCategory(determinedCategory),
      excitement: excitement,
      duration: estimateDurationByCategory(determinedCategory)
    };

    res.json(result);
  } catch (error) {
    console.error('Error parsing TripAdvisor URL:', error);
    res.status(500).json({ error: 'Failed to parse TripAdvisor URL' });
  }
}

async function parseGenericUrl(url, res) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    // Discord-style generic webpage parsing
    function parseGenericWebpage($, url) {
      const ogData = extractOpenGraphData($);

      // Use Open Graph data as primary source (Discord's approach)
      const title = ogData.title ||
        $('title').text().trim() ||
        $('h1').first().text().trim() ||
        'Web Page';

      const description = ogData.description ||
        $('meta[name="description"]').attr('content') ||
        $('meta[property="description"]').attr('content') ||
        $('.description').text().trim() ||
        $('p').first().text().trim().substring(0, 200) ||
        'Content from web page';

      const imageUrl = ogData.image ||
        ogData['image:url'] ||
        $('meta[name="twitter:image"]').attr('content') ||
        $('link[rel="image_src"]').attr('href') ||
        $('img[src*="http"]').first().attr('src') ||
        null;

      // Try to extract address information
      let address = '';
      const addressSelectors = [
        '[itemprop="streetAddress"]',
        '[itemprop="address"]',
        '.address',
        '.location',
        '[class*="address"]',
        '[class*="location"]'
      ];

      for (const selector of addressSelectors) {
        const addressText = $(selector).text().trim();
        if (addressText && addressText.length > 5) {
          address = addressText;
          break;
        }
      }

      return {
        title,
        description,
        imageUrl: processImageUrl(imageUrl, title, address),
        address,
        ogData
      };
    }

    // Use Discord-style parsing for generic webpages
    const genericInfo = parseGenericWebpage($, url);

    const result = {
      title: genericInfo.title.length > 100 ? genericInfo.title.substring(0, 100) + '...' : genericInfo.title,      description: genericInfo.description.length > 300 ? genericInfo.description.substring(0, 300) + '...' : genericInfo.description,
      category: determineCategory(genericInfo.title, genericInfo.description),
      location: 'See link for details',
      url: url,
      image_url: genericInfo.imageUrl,
      estimated_cost: 0,
      excitement: 0,
      duration: 120
    };

    res.json(result);
  } catch (error) {
    console.error('Error parsing generic URL:', error);
    res.status(500).json({ error: 'Failed to parse webpage' });
  }
}

function determineCategory(title, content) {
  const text = (title + ' ' + content).toLowerCase();
  if (text.includes('restaurant') || text.includes('food') || text.includes('dining') ||
    text.includes('cafe') || text.includes('bar') || text.includes('pizza') ||
    text.includes('cuisine') || text.includes('menu') || text.includes('coffee') ||
    text.includes('bakery') || text.includes('deli') || text.includes('bistro') ||
    text.includes('sweet') || text.includes('dessert') || text.includes('indian') ||
    text.includes('chinese') || text.includes('thai') || text.includes('italian') ||
    text.includes('mexican') || text.includes('grill') || text.includes('kitchen')) {
    return 'Food & Dining';
  }

  if (text.includes('movie') || text.includes('theater') || text.includes('cinema') ||
    text.includes('show') || text.includes('concert') || text.includes('music') ||
    text.includes('entertainment') || text.includes('club') || text.includes('venue')) {
    return 'Entertainment';
  }

  if (text.includes('hike') || text.includes('trail') || text.includes('park') ||
    text.includes('outdoor') || text.includes('nature') || text.includes('beach') ||
    text.includes('mountain') || text.includes('camping') || text.includes('garden') ||
    text.includes('zoo') || text.includes('aquarium')) {
    return 'Outdoor';
  }

  if (text.includes('spa') || text.includes('massage') || text.includes('relax') ||
    text.includes('wellness') || text.includes('meditation') || text.includes('salon')) {
    return 'Relaxation';
  }

  if (text.includes('adventure') || text.includes('extreme') || text.includes('sport') ||
    text.includes('climb') || text.includes('jump') || text.includes('race') ||
    text.includes('gym') || text.includes('fitness')) {
    return 'Adventure';
  }

  if (text.includes('travel') || text.includes('hotel') || text.includes('flight') ||
    text.includes('vacation') || text.includes('trip') || text.includes('resort')) {
    return 'Travel';
  }

  if (text.includes('romantic') || text.includes('date') || text.includes('couple') ||
    text.includes('intimate') || text.includes('wine') || text.includes('lounge')) {
    return 'Date Night';
  }

  if (text.includes('museum') || text.includes('gallery') || text.includes('art') ||
    text.includes('history') || text.includes('cultural') || text.includes('exhibit')) {
    return 'Cultural';
  }

  if (text.includes('shop') || text.includes('store') || text.includes('mall') ||
    text.includes('market') || text.includes('boutique') || text.includes('retail')) {
    return 'Shopping';
  }

  return 'Entertainment'; // Default category
}

function estimateCostByCategory(category) {
  const costs = {
    'Food & Dining': 50,
    'Entertainment': 25,
    'Outdoor': 10,
    'Relaxation': 80,
    'Adventure': 60,
    'Travel': 200,
    'Date Night': 75,
    'Cultural': 20,
    'Shopping': 100
  };

  return costs[category] || 25;
}

function estimateDurationByCategory(category) {
  const durations = {
    'Food & Dining': 90,      // 1.5 hours
    'Entertainment': 150,     // 2.5 hours
    'Outdoor': 180,          // 3 hours
    'Relaxation': 120,       // 2 hours
    'Adventure': 240,        // 4 hours
    'Travel': 480,           // 8 hours
    'Date Night': 180,       // 3 hours
    'Cultural': 120,         // 2 hours
    'Shopping': 150          // 2.5 hours
  };

  return durations[category] || 120;
}

// Enhanced Instagram URL handling to support various formats
function normalizeInstagramUrl(url) {
  try {
    const urlObj = new URL(url);

    // Handle shortened Instagram URLs
    if (urlObj.hostname === 'instagr.am') {
      return url.replace('instagr.am', 'instagram.com');
    }

    // Handle mobile Instagram URLs
    if (urlObj.hostname === 'm.instagram.com') {
      return url.replace('m.instagram.com', 'instagram.com');
    }

    // Remove tracking parameters
    urlObj.searchParams.delete('utm_source');
    urlObj.searchParams.delete('utm_medium');
    urlObj.searchParams.delete('utm_campaign');
    urlObj.searchParams.delete('igshid');
    urlObj.searchParams.delete('igsh');

    return urlObj.toString();
  } catch (error) {
    return url;
  }
}

async function parseInstagramUrl(url, res) {
  try {
    // Normalize the URL first
    const normalizedUrl = normalizeInstagramUrl(url);
    console.log('Parsing Instagram URL:', normalizedUrl);

    // Parse post type from URL
    const postType = determineInstagramPostType(normalizedUrl, '');
    const username = extractUsernameFromUrl(normalizedUrl);    // For Instagram, provide basic structure and let user fill in details
    const result = {
      title: ``,
      description: ``,
      category: 'Entertainment', // Default category, user can change
      location: '',
      url: normalizedUrl,
      image_url: null, // Instagram blocks direct image access
      estimated_cost: 0, // Let user specify
      excitement: 0, // User to set excitement level
      duration: 120, // Default 2 hours, user can adjust
      source: 'Instagram',
      author: username,
      hashtags: [],
      manual_input_required: true // Flag to indicate user should fill details
    };

    console.log('Instagram parsing result (manual input required):', result);
    res.json(result);

  } catch (error) {
    console.error('Error parsing Instagram URL:', error);    // Fallback response
    const fallbackResult = {
      title: 'Instagram Activity',
      description: 'Activity idea from Instagram - please add details about what you want to do',
      category: 'Entertainment',
      location: 'Add location here',
      url: url,
      image_url: null,
      estimated_cost: 0,
      excitement: 0,
      duration: 120,
      source: 'Instagram',
      manual_input_required: true
    };

    res.json(fallbackResult);
  }
}

function extractUsernameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

    // Instagram URL formats:
    // https://www.instagram.com/username/
    // https://www.instagram.com/p/POST_ID/ (post)
    // https://www.instagram.com/reel/REEL_ID/ (reel)
    // https://www.instagram.com/stories/username/STORY_ID/ (story)

    if (pathParts[0] === 'stories' && pathParts[1]) {
      return pathParts[1];
    } else if (pathParts[0] && !['p', 'reel', 'tv'].includes(pathParts[0])) {
      return pathParts[0];
    }

    return null;
  } catch (error) {
    return null;
  }
}

function determineCategoryFromInstagram(hashtags = [], description = '', title = '') {
  const text = (description + ' ' + title + ' ' + hashtags.join(' ')).toLowerCase();

  // Define category keywords for Instagram content
  const categoryMap = {
    'Food & Dining': ['food', 'restaurant', 'cafe', 'dinner', 'lunch', 'brunch', 'foodie', 'eating', 'meal', 'cook', 'recipe', 'chef', 'cuisine', 'delicious', 'tasty'],
    'Travel': ['travel', 'vacation', 'trip', 'explore', 'adventure', 'wanderlust', 'journey', 'destination', 'tourism', 'holiday', 'getaway', 'backpack'],
    'Entertainment': ['concert', 'movie', 'show', 'theater', 'music', 'festival', 'party', 'entertainment', 'fun', 'event', 'performance', 'dance'],
    'Outdoor': ['nature', 'hiking', 'beach', 'park', 'outdoor', 'sunset', 'sunrise', 'landscape', 'mountain', 'forest', 'lake', 'ocean', 'walk', 'run'],
    'Cultural': ['museum', 'art', 'gallery', 'history', 'culture', 'exhibit', 'artist', 'painting', 'sculpture', 'cultural', 'heritage', 'traditional'],
    'Relaxation': ['spa', 'relax', 'massage', 'wellness', 'meditation', 'yoga', 'peaceful', 'calm', 'zen', 'selfcare', 'mindfulness'],
    'Shopping': ['shopping', 'store', 'boutique', 'fashion', 'style', 'outfit', 'retail', 'mall', 'clothes', 'accessories', 'shoes'],
    'Adventure': ['adventure', 'extreme', 'sport', 'climbing', 'skiing', 'surfing', 'diving', 'kayak', 'bike', 'motorcycle', 'adrenaline'],
    'Date Night': ['date', 'romantic', 'couple', 'love', 'together', 'anniversary', 'valentine', 'romance', 'intimate', 'wine', 'candlelight']
  };

  // Count matches for each category
  const scores = {};
  for (const [category, keywords] of Object.entries(categoryMap)) {
    scores[category] = keywords.reduce((score, keyword) => {
      return score + (text.includes(keyword) ? 1 : 0);
    }, 0);
  }

  // Find category with highest score
  const bestMatch = Object.entries(scores).reduce((best, [category, score]) => {
    return score > best.score ? { category, score } : best;
  }, { category: 'Entertainment', score: 0 });

  return bestMatch.category;
}

function determineInstagramPostType(url, title = '') {
  if (url.includes('/reel/')) return 'Reel';
  if (url.includes('/tv/')) return 'IGTV';
  if (url.includes('/stories/')) return 'Story';
  if (url.includes('/p/')) return 'Post';

  // Check title for clues
  if (title?.toLowerCase().includes('reel')) return 'Reel';
  if (title?.toLowerCase().includes('story')) return 'Story';

  return 'Post';
}

function estimateInstagramDuration(postType, category) {
  // Base duration by post type
  const typeDurations = {
    'Post': 120,   // 2 hours - typical activity duration
    'Reel': 60,    // 1 hour - shorter activities
    'Story': 90,   // 1.5 hours - medium activities
    'IGTV': 180    // 3 hours - longer form content
  };

  // Adjust by category
  const categoryMultipliers = {
    'Food & Dining': 1.2,
    'Travel': 2.0,
    'Adventure': 1.8,
    'Cultural': 1.5,
    'Entertainment': 1.3,
    'Outdoor': 1.6,
    'Relaxation': 1.1,
    'Shopping': 1.4,
    'Date Night': 1.3
  };

  const baseDuration = typeDurations[postType] || 120;
  const multiplier = categoryMultipliers[category] || 1;

  return Math.round(baseDuration * multiplier);
}

function sanitizeTitle(title) {
  if (!title) return null;

  // Remove Instagram-specific prefixes and clean up
  return title
    .replace(/^Instagram\s+/i, '')
    .replace(/\s+•\s+Instagram$/, '')
    .replace(/^@\w+:\s*/, '') // Remove username prefix
    .trim();
}

// Enhanced image URL processing (Discord-style approach)
function processImageUrl(imageUrl, title, address) {
  if (!imageUrl) return null;

  // Clean up Google image URLs to get higher quality versions
  if (imageUrl.includes('googleusercontent.com')) {
    // Remove size restrictions and get higher quality image
    imageUrl = imageUrl.replace(/=s\d+-w\d+-h\d+/, '=s800-w800-h600')
      .replace(/=w\d+-h\d+/, '=w800-h600')
      .replace(/=s\d+/, '=s800');
  }

  // If it's a Google Maps static image, enhance it
  if (imageUrl.includes('maps.googleapis.com/maps/api/staticmap')) {
    // Add better zoom and size parameters
    const url = new URL(imageUrl);
    url.searchParams.set('zoom', '15');
    url.searchParams.set('size', '640x400');
    url.searchParams.set('scale', '2');
    imageUrl = url.toString();
  }

  // Generate a fallback Google Static Map if no image found
  if (!imageUrl && address && address !== 'See Google Maps link') {
    const encodedAddress = encodeURIComponent(address);
    imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=15&size=640x400&scale=2&maptype=roadmap&markers=color:red%7C${encodedAddress}&key=YOUR_API_KEY`;
  }

  return imageUrl;
}

// Enhanced Open Graph metadata extraction (Discord's primary method)
function extractOpenGraphData($) {
  const ogData = {};

  // Extract all Open Graph tags
  $('meta[property^="og:"]').each(function () {
    const property = $(this).attr('property');
    const content = $(this).attr('content');
    if (property && content) {
      const key = property.replace('og:', '');
      ogData[key] = content;
    }
  });

  // Also check for Twitter Card data as fallback
  $('meta[name^="twitter:"]').each(function () {
    const name = $(this).attr('name');
    const content = $(this).attr('content');
    if (name && content) {
      const key = name.replace('twitter:', '');
      if (!ogData[key]) {
        ogData[key] = content;
      }
    }
  });

  return ogData;
}

module.exports = router;
