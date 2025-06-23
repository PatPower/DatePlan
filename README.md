# DatePlan - Couples Activity Planner

A beautiful and intuitive web application designed for couples to discover, organize, and plan activities together. Features a drag-and-drop calendar interface and automatic link parsing for seamless activity creation.

## ✨ Features

### 🗓️ Interactive Calendar
- **Drag & Drop Planning**: Simply drag activities from your list onto calendar dates
- **Month & Week Views**: Switch between different calendar views
- **Visual Event Management**: See all your planned activities at a glance
- **Event Details**: Click on events to view, edit, or mark as complete

### 📝 Activity Management
- **Smart Link Parsing**: Paste URLs from Google Maps, Yelp, TripAdvisor, or any website to auto-fill activity details
- **Categorized Activities**: Organize ideas by categories like Date Night, Adventure, Food & Dining, etc.
- **Rich Details**: Track location, duration, cost estimates, and ratings
- **Search & Filter**: Quickly find activities by name, category, or location

### 📊 Progress Tracking
- **Activity Statistics**: Monitor total ideas, planned activities, and completed experiences
- **Completion Status**: Mark activities as done and track your adventures together
- **Visual Feedback**: Beautiful UI with color-coded categories and status indicators

### 🎨 Modern Design
- **Responsive Layout**: Works perfectly on desktop, tablet, and mobile devices
- **Intuitive Interface**: Clean, modern design that's easy to navigate
- **Accessibility**: Built with accessibility best practices in mind

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/DatePlan.git
   cd DatePlan
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

### Development Mode
For development with auto-restart on file changes:
```bash
npm run dev
```

## 📖 How to Use

### Adding Activities

1. **Manual Entry**: Click "Add Activity" and fill in the details
2. **Smart Parsing**: Paste a URL from:
   - Google Maps (restaurants, attractions, locations)
   - Yelp (businesses, restaurants)
   - TripAdvisor (activities, attractions)
   - Any website (basic details extracted)

### Planning Activities

1. **Drag & Drop**: Drag any activity from the sidebar onto a calendar date
2. **View Plans**: Click on calendar events to see details
3. **Mark Complete**: Update activities as you complete them
4. **Track Progress**: Monitor your planning statistics

### Categories

Activities are automatically categorized:
- 🌹 **Date Night**: Romantic activities and intimate experiences
- 🏔️ **Adventure**: Outdoor activities and thrilling experiences
- 🧘 **Relaxation**: Spa, wellness, and peaceful activities
- 🍕 **Food & Dining**: Restaurants, cafes, and culinary experiences
- 🎭 **Entertainment**: Movies, shows, and cultural activities
- ✈️ **Travel**: Trips, hotels, and vacation planning
- 🌳 **Outdoor**: Parks, hiking, and nature activities
- 🏠 **Home Activities**: Things to do at home together

## 🛠️ Technology Stack

### Backend
- **Node.js**: Server runtime
- **Express.js**: Web framework
- **SQLite3**: Database (file-based, no setup required)
- **Cheerio**: Web scraping for link parsing
- **Axios**: HTTP client for fetching web content

### Frontend
- **Vanilla JavaScript**: No framework dependencies
- **CSS Grid & Flexbox**: Modern layout techniques
- **Font Awesome**: Icon library
- **Google Fonts**: Typography (Poppins)

### Features
- **RESTful API**: Clean API design for all operations
- **Responsive Design**: Mobile-first approach
- **Modern CSS**: CSS variables, animations, and modern selectors
- **Accessibility**: ARIA labels and keyboard navigation

## 📁 Project Structure

```
DatePlan/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── database/
│   └── db.js             # Database setup and schema
├── routes/
│   ├── activities.js     # Activity CRUD operations
│   ├── calendar.js       # Calendar event management
│   └── linkParser.js     # URL parsing functionality
└── public/
    ├── index.html        # Main HTML file
    ├── styles.css        # All styles
    └── script.js         # Frontend JavaScript
```

## 🔧 API Endpoints

### Activities
- `GET /api/activities` - Get all activities
- `POST /api/activities` - Create new activity
- `GET /api/activities/:id` - Get activity by ID
- `PUT /api/activities/:id` - Update activity
- `DELETE /api/activities/:id` - Delete activity
- `GET /api/activities/categories/all` - Get all categories

### Calendar
- `GET /api/calendar` - Get all calendar events
- `POST /api/calendar` - Create new event
- `GET /api/calendar/:id` - Get event by ID
- `PUT /api/calendar/:id` - Update event
- `DELETE /api/calendar/:id` - Delete event
- `PATCH /api/calendar/:id/complete` - Toggle completion status

### Link Parser
- `POST /api/parse-link` - Parse URL and extract activity details

## 🎯 Supported Link Types

The app can automatically extract information from:

- **Google Maps**: Business names, addresses, ratings
- **Yelp**: Restaurant details, pricing, ratings, categories
- **TripAdvisor**: Activity descriptions, ratings, locations
- **Generic Websites**: Page titles, descriptions, images

## 💡 Tips for Couples

1. **Weekly Planning Sessions**: Set aside time each week to browse and add new activity ideas
2. **Seasonal Lists**: Create activities appropriate for different seasons
3. **Budget Planning**: Use the cost estimates to plan activities within your budget
4. **Surprise Planning**: One partner can secretly plan activities for special occasions
5. **Memory Keeping**: Mark activities as complete and add notes about your experiences

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Font Awesome for the beautiful icons
- Google Fonts for the Poppins font family
- The open-source community for inspiration and tools

## 🐛 Bug Reports & Feature Requests

If you encounter any bugs or have feature requests, please create an issue on GitHub with:
- A clear description of the problem or feature
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Screenshots if applicable

---

Made with ❤️ for couples who love planning adventures together!
