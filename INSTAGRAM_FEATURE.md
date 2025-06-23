# Instagram Post Integration 📸

DatePlan now supports extracting activity details from Instagram posts! Here's how it works:

## ✨ Features

### Supported Instagram URL Types
- **Regular Posts**: `https://www.instagram.com/p/POST_ID/`
- **Reels**: `https://www.instagram.com/reel/REEL_ID/`
- **IGTV**: `https://www.instagram.com/tv/VIDEO_ID/`
- **Stories**: `https://www.instagram.com/stories/username/STORY_ID/`
- **Mobile URLs**: `m.instagram.com` (automatically converted)
- **Short URLs**: `instagr.am` (automatically converted)

### What Gets Extracted
- **Title**: Post title or generated from username
- **Description**: Post caption/description
- **Location**: Extracted from post text if mentioned
- **Image**: Post thumbnail/image
- **Category**: Auto-categorized based on hashtags and content
- **Duration**: Estimated based on post type and category
- **Cost**: Estimated based on activity category

### Smart Category Detection
The system analyzes hashtags and post content to categorize activities:

- **Food & Dining**: #food, #restaurant, #brunch, #foodie
- **Travel**: #travel, #vacation, #wanderlust, #explore
- **Entertainment**: #concert, #movie, #festival, #party
- **Outdoor**: #nature, #hiking, #beach, #sunset
- **Cultural**: #museum, #art, #gallery, #culture
- **Relaxation**: #spa, #yoga, #wellness, #meditation
- **Shopping**: #shopping, #fashion, #boutique, #style
- **Adventure**: #adventure, #extreme, #climbing, #surfing
- **Date Night**: #date, #romantic, #couple, #anniversary

### Duration Estimation
Different post types get different base durations:
- **Posts**: 2 hours (typical activity)
- **Reels**: 1 hour (shorter activities)
- **Stories**: 1.5 hours (medium activities)
- **IGTV**: 3 hours (longer content)

Then adjusted by category (Travel gets 2x multiplier, etc.)

## 🎯 How to Use

1. **Find an Instagram Post**: Browse Instagram for activity inspiration
2. **Copy the URL**: Use the share button to copy the post link
3. **Open DatePlan**: Go to "Add Activity"
4. **Paste & Auto-fill**: Paste the Instagram URL and click "Auto-fill"
5. **Review & Save**: Adjust details if needed and save your activity
6. **Plan Your Date**: Drag the activity to your calendar!

## 📱 Mobile-Friendly
- Works great on mobile devices
- Touch-friendly interface
- Responsive design for all screen sizes

## 🔒 Privacy & Limitations
- Only extracts publicly available information
- Works with public posts only
- No Instagram login required
- Respects Instagram's content policies
- Fallback handling for when posts can't be accessed

## 💡 Pro Tips
- Posts with location tags work best
- Hashtags help with better categorization
- Business/restaurant posts often have the most useful details
- Travel and food posts tend to extract the most information

## 🛠️ Technical Notes
- Uses Instagram's Open Graph meta tags
- Handles various URL formats automatically
- Removes tracking parameters for cleaner URLs
- Graceful fallback when scraping fails

Enjoy discovering new date ideas from Instagram! 💕
