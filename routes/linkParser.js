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

  try {
    // Validate URL
    const urlObj = new URL(url);    // Check if it's a Google Maps link
    if (urlObj.hostname.includes('google.com') && urlObj.pathname.includes('/maps') || 
        urlObj.hostname.includes('maps.google') || urlObj.hostname.includes('goo.gl') || 
        urlObj.hostname.includes('maps.app.goo.gl')) {
      return await parseGoogleMapsUrl(url, res);
    }
    
    // Check if it's an Apple Maps link
    if (urlObj.hostname.includes('maps.apple.com')) {
      return await parseAppleMapsUrl(url, res);
    }
    
    // Check if it's a Yelp link
    if (urlObj.hostname.includes('yelp.com')) {
      return await parseYelpUrl(url, res);
    }
    
    // Check if it's a TripAdvisor link
    if (urlObj.hostname.includes('tripadvisor.com')) {
      return await parseTripAdvisorUrl(url, res);
    }
    
    // Generic web page parsing
    return await parseGenericUrl(url, res);
    
  } catch (error) {
    console.error('Error parsing URL:', error);
    res.status(500).json({ 
      error: 'Failed to parse URL', 
      details: error.message 
    });
  }
});

async function parseGoogleMapsUrl(url, res) {
  try {
    // First, try to extract information from the URL itself
    const urlInfo = extractFromGoogleMapsUrl(url);
    
    // Then try to scrape the page for additional details
    let scrapedInfo = {};
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      
      // Try multiple selectors to find the place name
      scrapedInfo.title = $('h1[data-value="title"]').text().trim() || 
                         $('h1').first().text().trim() ||
                         $('[data-attrid="title"]').text().trim() ||
                         $('[role="main"] h1').text().trim() ||
                         $('title').text().replace(' - Google Maps', '').trim();
      
      // Extract address with multiple selectors
      scrapedInfo.address = $('[data-value="address"]').text().trim() || 
                           $('[data-item-id="address"]').text().trim() ||
                           $('[data-attrid="kc:/location/location:address"]').text().trim() ||
                           $('span[jsan]').filter(function() {
                             return $(this).text().match(/\d+.*[A-Z]{2}\s+\d{5}/);
                           }).first().text().trim();
      
      // Extract rating
      const ratingText = $('[data-value="rating"]').text().trim() ||
                        $('span[aria-label*="star"]').attr('aria-label') ||
                        $('span').filter(function() {
                          return $(this).text().match(/^\d+\.\d+$/);
                        }).first().text().trim();
      scrapedInfo.rating = ratingText ? parseFloat(ratingText.match(/\d+\.?\d*/)?.[0] || '0') : 0;
      
      // Try to extract business type/category
      scrapedInfo.businessType = $('[data-value="category"]').text().trim() ||
                                 $('button[data-value="category"]').text().trim() ||
                                 $('.section-result-text-buttons button').first().text().trim();    } catch (scrapeError) {
      console.log('Scraping failed, using URL extraction only:', scrapeError.message);    }

    // Combine URL extraction with scraped data, prioritizing URL extraction for title if it's meaningful
    // Only use scraped title if URL extraction didn't find a place name or if scraped title is more specific
    const title = (urlInfo.placeName && !scrapedInfo.title?.includes('Google Maps')) ? 
                  urlInfo.placeName : 
                  (scrapedInfo.title && !scrapedInfo.title.includes('Google Maps')) ? 
                  scrapedInfo.title : 
                  urlInfo.placeName || 
                  'Location from Google Maps';
    const address = scrapedInfo.address || urlInfo.address || 'See Google Maps link';
    const rating = scrapedInfo.rating || 0;
    const businessType = scrapedInfo.businessType || '';
    
    // Extract category
    const category = determineCategory(title, address + ' ' + businessType);
    
    const result = {
      title: title,
      description: `${businessType ? businessType + ' - ' : ''}Location found on Google Maps${address && address !== 'See Google Maps link' ? ': ' + address : ''}`,
      category: category,
      location: address,
      url: url,
      image_url: null,
      estimated_cost: estimateCostByCategory(category),
      rating: rating,
      duration: estimateDurationByCategory(category)
    };

    res.json(result);
  } catch (error) {
    console.error('Error parsing Google Maps URL:', error);
    res.status(500).json({ error: 'Failed to parse Google Maps URL' });
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
    }
      // Clean up the place name
    if (result.placeName) {
      // Remove common suffixes and clean up
      result.placeName = result.placeName
        .replace(/@.*$/, '')      // Remove @coordinates and everything after
        .replace(/\+/g, ' ')      // Replace + with spaces
        .replace(/,$/, '')        // Remove trailing comma
        .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
        .trim();
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
    const category = determineCategory(title, '');
    
    const result = {
      title: title,
      description: `Location found on Apple Maps${ll ? ' (coordinates: ' + ll + ')' : ''}`,
      category: category,
      location: address || 'See Apple Maps link',
      url: url,
      image_url: null,
      estimated_cost: estimateCostByCategory(category),
      rating: 0,
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
                  'Yelp Business';
    
    // Extract rating with multiple selectors
    const ratingElement = $('.i-stars').attr('title') || 
                         $('.rating-large').attr('aria-label') ||
                         $('[data-testid="rating"]').text().trim();
    const rating = ratingElement ? parseFloat(ratingElement.match(/(\d+\.?\d*)/)?.[1] || '0') : 0;
    
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
                    'Food & Dining';
    
    // Extract image
    const imageUrl = $('.photo-box img').first().attr('src') ||
                    $('[data-testid="business-photo"] img').attr('src') ||
                    $('.js-business-photo img').first().attr('src');
    
    // Estimate cost based on price range
    let estimatedCost = estimateCostByCategory(determineCategory(title, category));
    if (priceRange.includes('$$$$')) estimatedCost = Math.max(estimatedCost, 100);
    else if (priceRange.includes('$$$')) estimatedCost = Math.max(estimatedCost, 60);
    else if (priceRange.includes('$$')) estimatedCost = Math.max(estimatedCost, 30);
    else if (priceRange.includes('$')) estimatedCost = Math.min(estimatedCost, 25);

    const determinedCategory = determineCategory(title, category);
    const result = {
      title: title,
      description: `${category} found on Yelp${address ? ' - ' + address.trim() : ''}`,
      category: determinedCategory,
      location: address ? address.trim() : 'See Yelp page for details',
      url: url,
      image_url: imageUrl,
      estimated_cost: estimatedCost,
      rating: rating,
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
                  'TripAdvisor Activity';
    
    // Extract rating
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
    
    const determinedCategory = determineCategory(title, activityType + ' ' + description);
    
    const result = {
      title: title,
      description: description || `${activityType} found on TripAdvisor${address ? ' - ' + address : ''}`,
      category: determinedCategory,
      location: address || 'See TripAdvisor page for details',
      url: url,
      image_url: null,
      estimated_cost: estimateCostByCategory(determinedCategory),
      rating: rating,
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
    
    // Try to extract meaningful information
    const title = $('title').text().trim() || 
                  $('h1').first().text().trim() || 
                  $('[property="og:title"]').attr('content') || 
                  'Web Activity';
    
    const description = $('[property="og:description"]').attr('content') || 
                       $('meta[name="description"]').attr('content') || 
                       $('p').first().text().trim().substring(0, 200) || 
                       'Activity found on the web';
    
    const imageUrl = $('[property="og:image"]').attr('content') || 
                    $('img').first().attr('src');
    
    // Try to determine category from content
    const category = determineCategory(title, description);
    
    const result = {
      title: title.length > 100 ? title.substring(0, 100) + '...' : title,
      description: description.length > 300 ? description.substring(0, 300) + '...' : description,
      category: category,
      location: 'See link for details',
      url: url,
      image_url: imageUrl,
      estimated_cost: 0,
      rating: 0,
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

module.exports = router;
