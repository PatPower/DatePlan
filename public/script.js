// Global state
let currentDate = new Date();
let currentView = 'month';
let activities = [];
let categories = [];
let calendarEvents = [];
let activityHistory = [];
let draggedActivity = null;
let draggedEvent = null;

// DOM elements will be assigned after DOM loads
let activityModal = null;
let eventModal = null;
let timeModal = null;
let loadingSpinner = null;
let toastContainer = null;

// Define critical functions early for global access
function closeModal(modalId) {
    console.log('closeModal called with:', modalId); // Debug log

    // Force close all modals if modalId is not found
    if (!modalId) {
        console.warn('No modalId provided, closing all modals');
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
        return;
    }

    const modal = document.getElementById(modalId);
    console.log('Modal element found:', modal); // Debug log

    if (modal) {
        console.log('Modal classes before removal:', modal.classList.toString()); // Debug log
        modal.classList.remove('active');
        console.log('Modal classes after removal:', modal.classList.toString()); // Debug log
        console.log('Modal successfully closed:', modalId); // Debug log

        // Additional check to ensure modal is hidden
        if (modal.classList.contains('active')) {
            console.warn('Modal still active, forcing style change');
            modal.style.display = 'none';
            setTimeout(() => {
                modal.style.display = '';
                modal.classList.remove('active');
            }, 100);
        }
    } else {
        console.error('Modal not found:', modalId);
        // Try to close any active modals as fallback
        document.querySelectorAll('.modal.active').forEach(modal => {
            console.log('Force closing active modal:', modal.id);
            modal.classList.remove('active');
        });
    }
}

// Also create a global function to force close all modals
window.forceCloseAllModals = function () {
    console.log('Force closing all modals');
    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
};

// Make functions globally accessible for onclick handlers immediately
window.closeModal = closeModal;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function () {
    try {
        // Assign DOM elements after DOM is loaded
        activityModal = document.getElementById('activity-modal');
        eventModal = document.getElementById('event-modal');
        timeModal = document.getElementById('time-modal');
        loadingSpinner = document.getElementById('loading-spinner');
        toastContainer = document.getElementById('toast-container');

        await initializeApp();
        setupEventListeners();
        await loadData();
        renderCalendar();
        renderActivitiesList();
        renderActivitiesGrid();
        renderHistoryGrid();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        // Show a basic error message even if toast system isn't working
        alert('Failed to initialize the application. Please check the console for details and ensure the server is running.');
    }
});

// Initialize application
async function initializeApp() {
    showLoading();
    try {
        await loadCategories();
        hideLoading();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showToast('Failed to load application', 'error');
        hideLoading();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            switchTab(this.dataset.tab);
        });
    });

    // Calendar navigation
    document.getElementById('prev-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    // View options
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            currentView = this.dataset.view;
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderCalendar();
        });
    });

    // Add activity button
    document.getElementById('add-activity-btn').addEventListener('click', () => {
        openActivityModal();
    });

    // Inline add activity button
    const inlineBtn = document.getElementById('add-activity-inline-btn');
    if (inlineBtn) {
        inlineBtn.addEventListener('click', () => {
            openActivityModal();
        });
    }

    // Activity form
    document.getElementById('activity-form').addEventListener('submit', handleActivitySubmit);

    // Time form
    document.getElementById('time-form').addEventListener('submit', handleTimeSubmit);

    // URL parser
    document.getElementById('parse-url-btn').addEventListener('click', handleParseUrl);    // Search and filter
    document.getElementById('activity-search').addEventListener('input', filterActivities);
    document.getElementById('category-filter').addEventListener('change', filterActivities);

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const modal = this.closest('.modal');
            if (modal) {
                console.log('Close button clicked for modal:', modal.id); // Debug log
                closeModal(modal.id);
            }
        });
    });

    // Modal close on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function (e) {
            if (e.target === this) {
                console.log('Backdrop click for modal:', this.id); // Debug log
                closeModal(this.id);
            }
        });
    });

    // Specific event listeners for event confirmation modal buttons
    const eventConfirmationModal = document.getElementById('event-confirmation-modal');
    if (eventConfirmationModal) {
        const closeButtons = eventConfirmationModal.querySelectorAll('.modal-close, .btn-secondary');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Event confirmation modal close button clicked'); // Debug log
                closeModal('event-confirmation-modal');
            });
        });
    }

    // Add ESC key listener to close modals
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                console.log('ESC pressed, closing modal:', activeModal.id);
                closeModal(activeModal.id);
            }
        }
    });
}

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');    // Refresh data if switching to activities tab
    if (tabName === 'activities') {
        renderActivitiesGrid();
        renderHistoryGrid();
    }
}

// Load all data
async function loadData() {
    try {
        await Promise.all([
            loadActivities(),
            loadCalendarEvents(),
            loadActivityHistory()
        ]);
        updateStats();
    } catch (error) {
        console.error('Failed to load data:', error);
        showToast('Failed to load data', 'error');
    }
}

// Load activities
async function loadActivities() {
    try {
        const response = await fetch('/api/activities');
        if (!response.ok) {
            throw new Error('Failed to load activities');
        }
        activities = await response.json();
    } catch (error) {
        console.error('Error loading activities:', error);
        activities = [];
    }
}

// Load categories
async function loadCategories() {
    try {
        const response = await fetch('/api/activities/categories/all');
        if (!response.ok) throw new Error('Failed to load categories');
        categories = await response.json();
        populateCategorySelects();
    } catch (error) {
        console.error('Error loading categories:', error);
        categories = [];
    }
}

// Load calendar events
async function loadCalendarEvents() {
    try {
        console.log('Loading calendar events...');
        const response = await fetch('/api/calendar');
        if (!response.ok) {
            console.error('Failed to load calendar events:', response.status, response.statusText);
            throw new Error('Failed to load calendar events');
        }
        calendarEvents = await response.json();
        console.log('Calendar events loaded:', calendarEvents.length);
    } catch (error) {
        console.error('Error loading calendar events:', error);
        calendarEvents = [];
    }
}

// Load activity history
async function loadActivityHistory() {
    try {
        console.log('Loading activity history...');
        const response = await fetch('/api/history');
        if (!response.ok) {
            console.error('Failed to load activity history:', response.status, response.statusText);
            throw new Error('Failed to load activity history');
        }
        activityHistory = await response.json();
        console.log('Activity history loaded:', activityHistory.length);
    } catch (error) {
        console.error('Error loading activity history:', error);
        activityHistory = [];
    }
}

// Populate category select elements
function populateCategorySelects() {
    const selects = [
        document.getElementById('activity-category'),
        document.getElementById('category-filter')
    ];

    selects.forEach(select => {
        if (select.id === 'category-filter') {
            select.innerHTML = '<option value="">All Categories</option>';
        } else {
            select.innerHTML = '';
        }

        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.name;
            option.textContent = category.name;
            select.appendChild(option);
        });
    });
}

// Render calendar
function renderCalendar() {
    const calendar = document.getElementById('calendar-grid');
    const monthHeader = document.getElementById('current-month');

    if (!calendar || !monthHeader) {
        console.error('Calendar elements not found!');
        return;
    }

    // Update month header
    monthHeader.textContent = currentDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    // Clear calendar
    calendar.innerHTML = '';

    if (currentView === 'month') {
        renderMonthView(calendar);
    } else {
        renderWeekView(calendar);
    }
}

// Render month view
function renderMonthView(calendar) {
    // Add day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendar.appendChild(header);
    });

    // Get first day of month and number of days
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // Generate calendar days
    for (let i = 0; i < 42; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + i);

        const dayElement = createCalendarDay(cellDate, firstDay.getMonth());
        calendar.appendChild(dayElement);
    }
}

// Render week view
function renderWeekView(calendar) {
    // Add day headers with dates
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    for (let i = 0; i < 7; i++) {
        const cellDate = new Date(startOfWeek);
        cellDate.setDate(startOfWeek.getDate() + i);

        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.innerHTML = `
            <div>${cellDate.toLocaleDateString('en-US', { weekday: 'short' })}</div>
            <div style="font-size: 0.75rem; font-weight: normal;">${cellDate.getDate()}</div>
        `;
        calendar.appendChild(header);
    }

    // Generate week days
    for (let i = 0; i < 7; i++) {
        const cellDate = new Date(startOfWeek);
        cellDate.setDate(startOfWeek.getDate() + i);

        const dayElement = createCalendarDay(cellDate, currentDate.getMonth());
        dayElement.style.minHeight = '200px';
        calendar.appendChild(dayElement);
    }
}

// Create calendar day element
function createCalendarDay(date, currentMonth) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';

    // Add data attribute for date (for highlighting)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    dayElement.setAttribute('data-date', dateStr);

    // Add classes for styling
    if (date.getMonth() !== currentMonth) {
        dayElement.classList.add('other-month');
    }

    if (isToday(date)) {
        dayElement.classList.add('today');
    }

    // Add day number
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = date.getDate();
    dayElement.appendChild(dayNumber);

    // Add events for this day
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'calendar-events';

    const dayEvents = getEventsForDay(date);
    dayEvents.forEach(event => {
        const eventElement = createEventElement(event);
        eventsContainer.appendChild(eventElement);
    });

    dayElement.appendChild(eventsContainer);

    // Add drag and drop functionality
    setupDragAndDrop(dayElement, date);
    setupMobileCalendarInteraction(dayElement, date); // Setup mobile interaction

    return dayElement;
}

// Create event element
function createEventElement(event) {
    const eventEl = document.createElement('div');
    eventEl.className = 'calendar-event';
    eventEl.draggable = true; // Make events draggable

    // Add data attribute for event ID (for highlighting)
    eventEl.setAttribute('data-event-id', event.id); if (event.completed) {
        eventEl.classList.add('completed');
    }

    if (event.is_archived) {
        eventEl.classList.add('archived');
        eventEl.draggable = false; // Archived events can't be dragged
    }

    // Get category color
    const category = categories.find(c => c.name === event.category);
    if (category) {
        eventEl.style.backgroundColor = category.color;
        // Make archived events more muted
        if (event.is_archived) {
            eventEl.style.opacity = '0.6';
            eventEl.style.fontStyle = 'italic';
        }
    }

    const startTime = new Date(event.start_date).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    eventEl.innerHTML = `
        <i class="fas fa-${event.is_archived ? 'archive' : 'clock'}"></i>
        <span>${startTime} - ${event.title}${event.is_archived ? ' (Archived)' : ''}</span>
    `;

    // Add drag event listeners for moving events (only if not archived)
    if (!event.is_archived) {
        eventEl.addEventListener('dragstart', (e) => handleEventDragStart(e, event));
        eventEl.addEventListener('dragend', handleEventDragEnd);
    }
    eventEl.addEventListener('click', () => showEventDetails(event));

    return eventEl;
}

// Setup drag and drop
function setupDragAndDrop(dayElement, date) {
    dayElement.addEventListener('dragover', handleDragOver);
    dayElement.addEventListener('dragenter', handleDragOver); // Add dragenter for consistent behavior
    dayElement.addEventListener('dragleave', handleDragLeave);
    dayElement.addEventListener('drop', (e) => handleDrop(e, date));
}

// Drag and drop handlers
function handleDragStart(e, activity) {
    draggedActivity = activity;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedActivity = null;
    // Ensure drop zone styling is removed from all days
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('drop-zone');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drop-zone');
}

function handleDragLeave(e) {
    e.preventDefault();  // Prevent default to ensure consistent behavior
    e.currentTarget.classList.remove('drop-zone');
}

async function handleDrop(e, date) {
    e.preventDefault();
    e.currentTarget.classList.remove('drop-zone');

    // Handle dropping an activity (create new event)
    if (draggedActivity) {
        openTimeModal(draggedActivity, date);
        return;
    }

    // Handle dropping an existing event (move event)
    if (draggedEvent) {
        await moveEventToNewDate(draggedEvent, date);
        return;
    }
}

// Drag and drop handlers for events
function handleEventDragStart(e, event) {
    draggedEvent = event;
    draggedActivity = null; // Clear any dragged activity
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation(); // Prevent event from bubbling up
}

function handleEventDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedEvent = null;
    // Ensure drop zone styling is removed from all days
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('drop-zone');
    });
}

// Move event to a new date
async function moveEventToNewDate(event, newDate) {
    try {
        showLoading();

        const originalStartDate = new Date(event.start_date);
        const originalEndDate = new Date(event.end_date);

        // Calculate the duration
        const duration = originalEndDate.getTime() - originalStartDate.getTime();

        // Create new start date with same time but new day
        const newStartDate = new Date(newDate);
        newStartDate.setHours(originalStartDate.getHours());
        newStartDate.setMinutes(originalStartDate.getMinutes());
        newStartDate.setSeconds(0);
        newStartDate.setMilliseconds(0);

        // Create new end date
        const newEndDate = new Date(newStartDate.getTime() + duration);

        // Update the event
        const updatedEventData = {
            ...event,
            start_date: newStartDate.toISOString(),
            end_date: newEndDate.toISOString()
        };

        const response = await fetch(`/api/calendar/${event.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedEventData)
        });

        if (!response.ok) throw new Error('Failed to move event');

        showToast(`Event moved to ${newDate.toLocaleDateString()}!`, 'success');

        // Refresh the calendar
        await loadCalendarEvents();
        renderCalendar();
        renderHistoryGrid(); // Update history to reflect new date
        updateStats();

    } catch (error) {
        console.error('Error moving event:', error);
        showToast('Failed to move event', 'error');
    } finally {
        hideLoading();
    }
}

// Mobile-friendly calendar interaction
function setupMobileCalendarInteraction(dayElement, date) {
    // Add click handler for mobile devices
    dayElement.addEventListener('click', (e) => {
        // Prevent if clicking on an existing event
        if (e.target.closest('.calendar-event')) {
            return;
        }

        // Check if this is a touch device or small screen
        if (window.innerWidth <= 768 || 'ontouchstart' in window) {
            e.preventDefault();
            openActivitySelectionModal(date);
        }
    });

    // Add touch-friendly styling
    dayElement.style.cursor = 'pointer';
    dayElement.setAttribute('data-date', date.toISOString());
}

// Activity Selection Modal for Mobile
function openActivitySelectionModal(date) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('activity-selection-modal');
    if (!modal) {
        createActivitySelectionModal();
        modal = document.getElementById('activity-selection-modal');
    }

    const activitiesList = document.getElementById('activity-selection-list');
    const selectedDateSpan = document.getElementById('activity-selection-date');

    // Set the selected date
    selectedDateSpan.textContent = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Clear and populate activities list
    activitiesList.innerHTML = '';

    const filteredActivities = getFilteredActivities();

    if (filteredActivities.length === 0) {
        activitiesList.innerHTML = `
            <div class="no-activities-message">
                <p>No activities available to schedule.</p>
                <button class="btn-primary" onclick="closeModal('activity-selection-modal'); openActivityModal();">
                    <i class="fas fa-plus"></i> Create New Activity
                </button>
            </div>
        `;
    } else {
        filteredActivities.forEach(activity => {
            const activityItem = createActivitySelectionItem(activity, date);
            activitiesList.appendChild(activityItem);
        });
    }

    modal.classList.add('active');
}

// Create the activity selection modal HTML
function createActivitySelectionModal() {
    const modalHTML = `
        <div class="modal" id="activity-selection-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Select Activity to Schedule</h3>
                    <button class="modal-close" onclick="closeModal('activity-selection-modal')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p class="selection-date-info">
                        Date: <span id="activity-selection-date"></span>
                    </p>
                    <div class="activity-selection-list" id="activity-selection-list">
                        <!-- Activities will be loaded here -->
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Helper function for mobile activity selection location
function createLocationMeta(activity) {
    if (!activity.location) return '';

    // Check if the activity has a URL that looks like Google Maps
    const isGoogleMapsUrl = activity.url && (
        activity.url.includes('google.com/maps') ||
        activity.url.includes('maps.google') ||
        activity.url.includes('g.co/kgs') ||
        activity.url.includes('maps.app.goo.gl')
    );

    if (isGoogleMapsUrl) {
        // Use the original Google Maps URL
        return `<span><i class="fas fa-map-marker-alt"></i> <a href="${activity.url}" target="_blank" rel="noopener noreferrer" class="location-link-small" title="Open in Google Maps">${activity.location}</a></span>`;
    } else if (activity.location && activity.location !== 'See Google Maps link' && activity.location !== 'See link for details') {
        // Create a Google Maps search URL for the address
        const encodedLocation = encodeURIComponent(activity.location);
        const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;

        return `<span><i class="fas fa-map-marker-alt"></i> <a href="${mapsSearchUrl}" target="_blank" rel="noopener noreferrer" class="location-link-small" title="Search in Google Maps">${activity.location}</a></span>`;
    } else {
        // Fallback for non-specific locations
        return `<span><i class="fas fa-map-marker-alt"></i> ${activity.location}</span>`;
    }
}

// Create individual activity selection item
function createActivitySelectionItem(activity, date) {
    const item = document.createElement('div');
    item.className = 'activity-selection-item';

    const category = categories.find(c => c.name === activity.category) || { color: '#6366f1' };
    const categoryClass = activity.category.toLowerCase().replace(/[^a-z0-9]/g, '-');

    item.innerHTML = `
        <div class="activity-selection-info">
            <div class="activity-selection-title">${activity.title}</div>
            <div class="activity-selection-category category-${categoryClass}">${activity.category}</div>            <div class="activity-selection-meta">
                <span><i class="fas fa-clock"></i> ${activity.duration || 120}min</span>
                <span><i class="fas fa-dollar-sign"></i> $${activity.estimated_cost || 0}</span>
                ${createLocationMeta(activity)}
            </div>
        </div>
        <button class="btn-primary activity-select-btn">
            <i class="fas fa-calendar-plus"></i>
            Schedule
        </button>
    `;

    // Add click handler for scheduling
    const scheduleBtn = item.querySelector('.activity-select-btn');
    scheduleBtn.addEventListener('click', () => {
        closeModal('activity-selection-modal');
        openTimeModal(activity, date);
    });

    return item;
}

// Render activities list (sidebar)
function renderActivitiesList() {
    const container = document.getElementById('activities-list');
    // Only show activities that haven't been scheduled yet in the sidebar
    const unscheduledActivities = activities.filter(activity => {
        return !calendarEvents.some(event => event.activity_id == activity.id);
    });

    // Apply additional filters (search, category)
    const searchTerm = document.getElementById('activity-search').value.toLowerCase();
    const categoryFilter = document.getElementById('category-filter').value;

    const filteredActivities = unscheduledActivities.filter(activity => {
        const matchesSearch = !searchTerm ||
            activity.title.toLowerCase().includes(searchTerm) ||
            (activity.description && activity.description.toLowerCase().includes(searchTerm)) ||
            (activity.location && activity.location.toLowerCase().includes(searchTerm));

        const matchesCategory = !categoryFilter || activity.category === categoryFilter;

        return matchesSearch && matchesCategory;
    });

    container.innerHTML = '';

    if (filteredActivities.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-light); padding: 2rem;">No unscheduled activities found</div>';
        return;
    }

    filteredActivities.forEach(activity => {
        const activityCard = createActivityCard(activity);
        container.appendChild(activityCard);
    });
}

// Create activity card for sidebar
function createActivityCard(activity) {
    const card = document.createElement('div');
    card.className = 'activity-card';
    card.draggable = true;

    // Get category info
    const category = categories.find(c => c.name === activity.category) || { color: '#6366f1' };
    const categoryClass = activity.category.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Add background image
    const backgroundImage = getActivityBackgroundImage(activity);
    if (backgroundImage) {
        card.classList.add('has-image');
        card.style.backgroundImage = `url(${backgroundImage})`;
    }

    card.innerHTML = `
        <div class="activity-header">
            <div class="activity-title">${activity.title}</div>
            <div class="activity-actions">
                <button class="activity-action-btn edit-btn" data-activity-id="${activity.id}" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="activity-action-btn delete-btn" data-activity-id="${activity.id}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="activity-category category-${categoryClass}">${activity.category}</div>
        ${createLocationLink(activity)}
        <div class="activity-meta">
            <span class="activity-duration">
                <i class="fas fa-clock"></i>
                ${activity.duration || 120}min
            </span>
            <span class="activity-cost">$${activity.estimated_cost || 0}</span>
        </div>
    `;

    // Add event listeners for action buttons
    const editBtn = card.querySelector('.edit-btn');
    const deleteBtn = card.querySelector('.delete-btn');

    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editActivity(activity.id);
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteActivity(activity.id);
        });
    }

    // Add drag event listeners
    card.addEventListener('dragstart', (e) => handleDragStart(e, activity));
    card.addEventListener('dragend', handleDragEnd);

    return card;
}

// Render activities grid (activities tab)
function renderActivitiesGrid() {
    const container = document.getElementById('activities-grid');
    container.innerHTML = '';

    // Only show activities that haven't been scheduled yet
    const unscheduledActivities = activities.filter(activity => {
        return !calendarEvents.some(event => event.activity_id == activity.id);
    });

    if (unscheduledActivities.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-light);">
                <i class="fas fa-lightbulb" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <h3>No unscheduled activities</h3>
                <p>All your activity ideas have been scheduled! Add new activities to see them here.</p>
            </div>
        `;
        return;
    }

    unscheduledActivities.forEach(activity => {
        const activityCard = createActivityCardLarge(activity);
        container.appendChild(activityCard);
    });
}

// Render history grid (planned and completed activities)
function renderHistoryGrid() {
    const container = document.getElementById('history-grid');
    container.innerHTML = '';

    // Combine scheduled events and completed activities
    const allHistoryItems = [];    // Add scheduled calendar events (convert to history format) - but exclude completed ones
    calendarEvents.forEach(event => {
        const activity = activities.find(a => a.id == event.activity_id);
        // Only add if the event is not completed (completed events should only appear in history table)
        if (activity && !event.completed) {
            allHistoryItems.push({
                id: `event-${event.id}`,
                type: 'scheduled',
                title: event.title,
                category: activity.category,
                location: activity.location,
                duration: activity.duration,
                event_start_date: event.start_date,
                event_end_date: event.end_date,
                scheduled_date: event.start_date,
                completed: event.completed,
                is_archived: event.is_archived,
                event_id: event.id,
                activity_id: activity.id
            });
        }
    });

    // Add completed activities from history table
    activityHistory.forEach(historyItem => {
        allHistoryItems.push({
            ...historyItem,
            type: 'completed'
        });
    });

    if (allHistoryItems.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-light);">
                <i class="fas fa-history" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <h3>No activity history</h3>
                <p>Schedule or complete some activities to see your history here!</p>
            </div>
        `;
        return;
    }

    // Sort all items by date (newest first) - use scheduled_date for scheduled items, completed_date for completed items
    allHistoryItems.sort((a, b) => {
        const dateA = new Date(a.type === 'scheduled' ? a.scheduled_date : a.completed_date);
        const dateB = new Date(b.type === 'scheduled' ? b.scheduled_date : b.completed_date);
        return dateB - dateA;
    });

    allHistoryItems.forEach(historyItem => {
        const historyCard = createHistoryCard(historyItem);
        container.appendChild(historyCard);
    });
}

// Create history card for scheduled and completed activities
function createHistoryCard(historyItem) {
    const card = document.createElement('div');

    const isScheduled = historyItem.type === 'scheduled';
    const isCompleted = historyItem.type === 'completed' || historyItem.completed;
    const isArchived = historyItem.is_archived;

    // Set card classes based on status
    if (isCompleted) {
        card.className = 'history-card completed';
    } else if (isScheduled) {
        card.className = 'history-card scheduled';
    }

    const category = categories.find(c => c.name === historyItem.category) || { color: '#6366f1' };
    const eventStartDate = new Date(historyItem.event_start_date);
    const eventEndDate = new Date(historyItem.event_end_date);

    // Status display
    let statusDisplay = '';
    let statusClass = '';
    let statusDate = '';

    if (isCompleted && historyItem.completed_date) {
        statusDisplay = 'Completed';
        statusClass = 'completed';
        const completedDate = new Date(historyItem.completed_date);
        statusDate = `
            <div class="history-card-completed-date">
                <i class="fas fa-check-circle"></i>
                Completed on ${completedDate.toLocaleDateString()}
            </div>
        `;
    } else if (isArchived) {
        statusDisplay = 'Archived';
        statusClass = 'archived';
    } else if (isScheduled) {
        statusDisplay = 'Scheduled';
        statusClass = 'scheduled';
    }

    card.innerHTML = `
        <div class="history-card-status ${statusClass}">
            ${statusDisplay}
        </div>
        <div class="history-card-title">${historyItem.title}</div>
        <div class="history-card-date">
            <i class="fas fa-calendar-day"></i>
            ${eventStartDate.toLocaleDateString()} at ${eventStartDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        ${statusDate}
        <div class="history-card-meta">
            <div class="history-card-category">${historyItem.category}</div>
            <div class="history-card-duration">
                <i class="fas fa-clock"></i> ${historyItem.duration || 120}min
            </div>
        </div>        ${historyItem.location ? `
            <div class="history-card-location">
                <i class="fas fa-map-marker-alt"></i>
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(historyItem.location)}" target="_blank" rel="noopener noreferrer" class="location-link" title="Search in Google Maps">
                    ${historyItem.location}
                </a>
            </div>
        ` : ''}
        <div class="history-card-actions">
            ${getHistoryCardActions(historyItem)}
        </div>
    `;

    // Add event listeners based on card type
    setupHistoryCardEventListeners(card, historyItem);

    return card;
}

// Get appropriate actions for history card based on type
function getHistoryCardActions(historyItem) {
    const isScheduled = historyItem.type === 'scheduled';
    const isCompleted = historyItem.type === 'completed' || historyItem.completed;
    const isArchived = historyItem.is_archived; if (isCompleted && historyItem.type === 'completed') {
        // Completed activities from history table
        return `
            <button class="btn-warning btn-small move-back-to-ideas-btn" data-history-id="${historyItem.id}">
                <i class="fas fa-undo"></i> Move Back to Ideas
            </button>
            <button class="btn-danger btn-small delete-history-btn" data-history-id="${historyItem.id}">
                <i class="fas fa-trash"></i> Delete
            </button>
        `;
    } else if (isScheduled) {
        // Scheduled calendar events
        return `
            <button class="btn-secondary btn-small edit-event-btn" data-event-id="${historyItem.event_id}">
                <i class="fas fa-edit"></i> Edit Event
            </button>
        `;
    }

    return '';
}

// Setup event listeners for history card buttons
function setupHistoryCardEventListeners(card, historyItem) {
    const isScheduled = historyItem.type === 'scheduled';
    const isCompleted = historyItem.type === 'completed'; if (isCompleted && historyItem.type === 'completed') {
        // Completed activities from history table
        const moveBackBtn = card.querySelector('.move-back-to-ideas-btn');
        const deleteBtn = card.querySelector('.delete-history-btn');

        if (moveBackBtn) {
            moveBackBtn.addEventListener('click', () => {
                moveHistoryItemBackToIdeas(historyItem.id);
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                deleteHistoryItem(historyItem.id);
            });
        }
    } else if (isScheduled) {
        // Scheduled calendar events
        const editBtn = card.querySelector('.edit-event-btn');

        if (editBtn) {
            editBtn.addEventListener('click', () => {
                const event = calendarEvents.find(e => e.id == historyItem.event_id);
                if (event) {
                    showEventDetails(event);
                }
            });
        }
    }
}

// Create large activity card for activities tab
function createActivityCardLarge(activity) {
    const card = document.createElement('div');
    card.className = 'activity-card-large';

    const category = categories.find(c => c.name === activity.category) || { color: '#6366f1' };
    const categoryClass = activity.category.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Check if this activity has been scheduled
    const scheduledEvent = calendarEvents.find(event => event.activity_id == activity.id);

    // Try to get a background image for the activity
    const backgroundImage = getActivityBackgroundImage(activity);
    if (backgroundImage) {
        card.classList.add('has-image');
        card.style.backgroundImage = `url(${backgroundImage})`;
    }

    card.innerHTML = `
        <div class="activity-title">${activity.title}</div>
        <div class="activity-category category-${categoryClass}">${activity.category}</div>
        ${activity.description ? `<div class="activity-description">${activity.description}</div>` : ''}
        <div class="activity-details">
            ${createLocationDetail(activity)}
            <div class="activity-detail"><i class="fas fa-clock"></i> ${activity.duration || 120} minutes</div>
            <div class="activity-detail"><i class="fas fa-dollar-sign"></i> $${activity.estimated_cost || 0}</div>
            ${activity.excitement > 0 ? `<div class="activity-detail"><i class="fas fa-fire"></i> ${activity.excitement}/10 excitement</div>` : ''}
        </div>
        <div class="activity-card-actions">            <button class="btn-secondary btn-small edit-large-btn" data-activity-id="${activity.id}">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn-secondary btn-small delete-large-btn" data-activity-id="${activity.id}">
                <i class="fas fa-trash"></i> Delete
            </button>
            ${activity.url ? `<a href="${activity.url}" target="_blank" class="btn-secondary btn-small">
                <i class="fas fa-external-link-alt"></i> Visit
            </a>` : ''}
        </div>
    `;    // Add event listeners for action buttons
    const editBtn = card.querySelector('.edit-large-btn');
    const deleteBtn = card.querySelector('.delete-large-btn');

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            editActivity(activity.id);
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            deleteActivity(activity.id);
        });
    } return card;
}

// Get background image for activity card
function getActivityBackgroundImage(activity) {
    // First, check if we have a direct image URL from parsing
    if (activity.image_url && activity.image_url.trim() &&
        !activity.image_url.includes('placeholder') &&
        activity.image_url !== 'null') {

        // Validate if it looks like a proper image URL
        const imageUrl = activity.image_url.trim();
        if (imageUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i) ||
            imageUrl.includes('unsplash.com') ||
            imageUrl.includes('googleusercontent.com') ||
            imageUrl.includes('yelp.com') ||
            imageUrl.includes('tripadvisor.com') ||
            imageUrl.includes('instagram.com')) {
            return imageUrl;
        }
    }

    // Check for Instagram links and try to use Instagram-style placeholder
    if (activity.url && (activity.url.includes('instagram.com') || activity.url.includes('instagr.am'))) {
        return getInstagramStylePlaceholder(activity);
    }

    // Check for Google Maps and try specific location images
    if (activity.url && (activity.url.includes('google.com/maps') || activity.url.includes('maps.google'))) {
        return getLocationPlaceholder(activity);
    }

    // Return category-based placeholder
    return getCategoryPlaceholder(activity);
}

// Get Instagram-style placeholder
function getInstagramStylePlaceholder(activity) {
    const keywords = [
        'coffee', 'restaurant', 'food', 'cafe', 'date', 'sunset', 'beach', 'city', 'night'
    ];

    const title = activity.title?.toLowerCase() || '';
    const location = activity.location?.toLowerCase() || '';
    const category = activity.category?.toLowerCase() || '';

    // Try to match keywords for better Instagram-style images
    for (const keyword of keywords) {
        if (title.includes(keyword) || location.includes(keyword) || category.includes(keyword)) {
            switch (keyword) {
                case 'coffee':
                case 'cafe':
                    return 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=250&fit=crop&auto=format';
                case 'restaurant':
                case 'food':
                    return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=250&fit=crop&auto=format';
                case 'beach':
                    return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=250&fit=crop&auto=format';
                case 'sunset':
                    return 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=250&fit=crop&auto=format';
                case 'city':
                    return 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=250&fit=crop&auto=format';
                case 'night':
                    return 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=400&h=250&fit=crop&auto=format';
            }
        }
    }

    return 'https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?w=400&h=250&fit=crop&auto=format';
}

// Get location-based placeholder
function getLocationPlaceholder(activity) {
    const location = activity.location?.toLowerCase() || '';
    const title = activity.title?.toLowerCase() || '';

    if (location.includes('park') || title.includes('park')) {
        return 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=250&fit=crop&auto=format';
    }
    if (location.includes('museum') || title.includes('museum')) {
        return 'https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=400&h=250&fit=crop&auto=format';
    }
    if (location.includes('beach') || title.includes('beach')) {
        return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=250&fit=crop&auto=format';
    }
    if (location.includes('mall') || location.includes('shop') || title.includes('shop')) {
        return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=250&fit=crop&auto=format';
    }

    return getCategoryPlaceholder(activity);
}

// Get category-based placeholder  
function getCategoryPlaceholder(activity) {
    const category = activity.category?.toLowerCase() || '';
    const title = activity.title?.toLowerCase() || '';
    const location = activity.location?.toLowerCase() || '';

    // Use Unsplash for category-based images with improved quality parameters
    const imageMap = {
        'restaurant': 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=250&fit=crop&auto=format&q=80',
        'food': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=250&fit=crop&auto=format&q=80',
        'entertainment': 'https://images.unsplash.com/photo-1489599312221-229fb1b80e9a?w=400&h=250&fit=crop&auto=format&q=80',
        'outdoor': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=250&fit=crop&auto=format&q=80',
        'adventure': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=250&fit=crop&auto=format&q=80',
        'cultural': 'https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=400&h=250&fit=crop&auto=format&q=80',
        'shopping': 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=250&fit=crop&auto=format&q=80',
        'sports': 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=250&fit=crop&auto=format&q=80',
        'fitness': 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=250&fit=crop&auto=format&q=80',
        'relaxation': 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&h=250&fit=crop&auto=format&q=80',
        'romantic': 'https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?w=400&h=250&fit=crop&auto=format&q=80',
        'dining': 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=250&fit=crop&auto=format&q=80'
    };

    // Try to match category
    for (const [key, url] of Object.entries(imageMap)) {
        if (category.includes(key) || title.includes(key)) {
            return url;
        }
    }

    // Specific keyword matching for better image selection
    if (title.includes('movie') || title.includes('cinema')) {
        return 'https://images.unsplash.com/photo-1489599312221-229fb1b80e9a?w=400&h=250&fit=crop&auto=format&q=80';
    }
    if (title.includes('coffee') || title.includes('cafe')) {
        return 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=250&fit=crop&auto=format&q=80';
    }
    if (title.includes('bar') || title.includes('drinks') || title.includes('cocktail')) {
        return 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=250&fit=crop&auto=format&q=80';
    }
    if (title.includes('spa') || title.includes('massage') || title.includes('wellness')) {
        return 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&h=250&fit=crop&auto=format&q=80';
    }

    // Default romantic/date image with better quality
    return 'https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?w=400&h=250&fit=crop&auto=format&q=80';
}

// Filter activities
function getFilteredActivities() {
    const searchTerm = document.getElementById('activity-search').value.toLowerCase();
    const categoryFilter = document.getElementById('category-filter').value;

    return activities.filter(activity => {
        const matchesSearch = !searchTerm ||
            activity.title.toLowerCase().includes(searchTerm) ||
            (activity.description && activity.description.toLowerCase().includes(searchTerm)) ||
            (activity.location && activity.location.toLowerCase().includes(searchTerm));

        const matchesCategory = !categoryFilter || activity.category === categoryFilter;

        return matchesSearch && matchesCategory;
    });
}

// Filter activities and re-render
function filterActivities() {
    renderActivitiesList();
}

// Get events for a specific day
function getEventsForDay(date) {
    const dateString = date.toDateString();
    return calendarEvents.filter(event => {
        const eventDate = new Date(event.start_date);
        return eventDate.toDateString() === dateString;
    });
}

// Check if date is today
function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

// Modal functions
function openActivityModal(activity = null) {
    const modal = document.getElementById('activity-modal');
    const title = document.getElementById('activity-modal-title');
    const form = document.getElementById('activity-form');

    if (activity) {
        title.textContent = 'Edit Activity';
        populateActivityForm(activity);
        form.dataset.activityId = activity.id;
    } else {
        title.textContent = 'Add New Activity';
        form.reset();
        delete form.dataset.activityId;
    }

    modal.classList.add('active');
}

function populateActivityForm(activity) {
    document.getElementById('activity-title').value = activity.title || '';
    document.getElementById('activity-description').value = activity.description || '';
    document.getElementById('activity-category').value = activity.category || '';
    document.getElementById('activity-location').value = activity.location || '';
    document.getElementById('activity-duration').value = activity.duration || 120;
    document.getElementById('activity-url').value = activity.url || '';
    document.getElementById('activity-image').value = activity.image_url || '';
    document.getElementById('activity-cost').value = activity.estimated_cost || 0;
    document.getElementById('activity-excitement').value = activity.excitement || 5;
}

// Handle activity form submission
async function handleActivitySubmit(e) {
    e.preventDefault();

    const form = e.target;
    const isEdit = !!form.dataset.activityId;

    const activityData = {
        title: document.getElementById('activity-title').value,
        description: document.getElementById('activity-description').value,
        category: document.getElementById('activity-category').value,
        location: document.getElementById('activity-location').value,
        duration: parseInt(document.getElementById('activity-duration').value),
        url: document.getElementById('activity-url').value,
        image_url: document.getElementById('activity-image').value,
        estimated_cost: parseFloat(document.getElementById('activity-cost').value),
        excitement: parseInt(document.getElementById('activity-excitement').value)
    };

    try {
        showLoading();

        const url = isEdit ? `/api/activities/${form.dataset.activityId}` : '/api/activities';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(activityData)
        });

        if (!response.ok) throw new Error('Failed to save activity'); showToast(isEdit ? 'Activity updated successfully!' : 'Activity created successfully!', 'success');
        closeModal('activity-modal'); await loadActivities();

        // If editing, update any related calendar events
        if (isEdit) {
            await updateRelatedCalendarEvents(form.dataset.activityId, activityData);
        }

        await loadCalendarEvents(); // Refresh calendar events to show updated activity titles
        await loadActivityHistory(); // Refresh activity history
        renderCalendar(); // Re-render calendar to show updated event titles
        renderActivitiesList();
        renderActivitiesGrid();
        renderHistoryGrid();
        updateStats();
    } catch (error) {
        console.error('Error saving activity:', error);
        showToast('Failed to save activity', 'error');
    } finally {
        hideLoading();
    }
}

// Update related calendar events when an activity is edited
async function updateRelatedCalendarEvents(activityId, updatedActivityData) {
    try {
        // Find all events that reference this activity
        const relatedEvents = calendarEvents.filter(event => event.activity_id == activityId);

        for (const event of relatedEvents) {
            // Update the event title to match the updated activity title
            const updatedEventData = {
                title: updatedActivityData.title,
                // Keep other event properties the same
                start_date: event.start_date,
                end_date: event.end_date,
                notes: event.notes,
                completed: event.completed
            };

            const response = await fetch(`/api/calendar/${event.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedEventData)
            });

            if (!response.ok) {
                console.error(`Failed to update event ${event.id}`);
            }
        }
    } catch (error) {
        console.error('Error updating related calendar events:', error);
    }
}

// Handle URL parsing
async function handleParseUrl() {
    const urlInput = document.getElementById('activity-url');
    const url = urlInput.value.trim();

    if (!url) {
        showToast('Please enter a URL first', 'warning');
        return;
    }

    try {
        showLoading();

        const response = await fetch('/api/parse-link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) throw new Error('Failed to parse URL'); const data = await response.json();

        // Show what data was extracted for debugging
        console.log('Parsed data:', data);

        // Populate form fields with parsed data
        if (data.title) document.getElementById('activity-title').value = data.title;
        if (data.description) document.getElementById('activity-description').value = data.description;
        if (data.category) document.getElementById('activity-category').value = data.category;
        if (data.location) document.getElementById('activity-location').value = data.location;
        if (data.duration) document.getElementById('activity-duration').value = data.duration;
        if (data.image_url) document.getElementById('activity-image').value = data.image_url;
        if (data.estimated_cost) document.getElementById('activity-cost').value = data.estimated_cost; if (data.excitement && data.excitement > 0) {
            document.getElementById('activity-excitement').value = data.excitement;
        } else if (data.rating && data.rating > 0) {
            // Convert legacy rating (1-5) to excitement (1-10)
            const excitement = Math.round(data.rating * 2);
            document.getElementById('activity-excitement').value = excitement;
        }

        // Show success message with extracted data summary
        let successMessage = 'Activity details filled automatically!';
        let detailsList = [];

        if (data.title) detailsList.push(`Title: ${data.title}`);
        if (data.location && data.location !== 'See Google Maps link') detailsList.push(`Location: ${data.location}`);
        if (data.excitement > 0) detailsList.push(`Excitement: ${data.excitement}/10`);
        else if (data.rating > 0) detailsList.push(`Rating: ${data.rating} stars (Excitement: ${Math.round(data.rating * 2)}/10)`);
        if (data._metadata?.businessType) detailsList.push(`Type: ${data._metadata.businessType}`);
        if (data.image_url) detailsList.push(`Image found`);

        if (data.source) {
            successMessage = `Details extracted from ${data.source}! Found: ${detailsList.join(', ')}`;
        } else if (detailsList.length > 0) {
            successMessage = `Activity details extracted! Found: ${detailsList.join(', ')}`;
        }

        // Special handling for Instagram posts that require manual input
        if (data.manual_input_required) {
            successMessage = `Basic structure created from ${data.source}! Please fill in the specific details about what you'd like to do based on this post.`;
            showToast(successMessage, 'info');

            // Focus on description field for Instagram posts
            setTimeout(() => {
                const descriptionField = document.getElementById('activity-description');
                if (descriptionField) {
                    descriptionField.focus();
                    descriptionField.select();
                }
            }, 100);
        } else {
            showToast(successMessage, 'success');
        }
    } catch (error) {
        console.error('Error parsing URL:', error);
        showToast('Failed to parse URL. Please fill details manually.', 'error');
    } finally {
        hideLoading();
    }
}

// Edit activity
function editActivity(id) {
    const activity = activities.find(a => a.id === id);
    if (activity) {
        openActivityModal(activity);
    }
}

// Delete activity
async function deleteActivity(id) {
    if (!confirm('Are you sure you want to delete this activity?')) {
        return;
    }

    try {
        showLoading();

        const response = await fetch(`/api/activities/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete activity'); showToast('Activity deleted successfully!', 'success');
        await loadActivities();
        await loadActivityHistory(); // Refresh activity history
        renderActivitiesList();
        renderActivitiesGrid();
        renderHistoryGrid();
        updateStats();
    } catch (error) {
        console.error('Error deleting activity:', error);
        showToast('Failed to delete activity', 'error');
    } finally {
        hideLoading();
    }
}

// Time Modal Functions
function openTimeModal(activity, date) {
    const modal = document.getElementById('time-modal');
    const activityTitle = document.getElementById('time-modal-activity-title');
    const selectedDate = document.getElementById('time-modal-selected-date');
    const timeForm = document.getElementById('time-form');

    // Store the activity and date for later use
    timeForm.dataset.activityId = activity.id;
    timeForm.dataset.selectedDate = date.toISOString();
    timeForm.dataset.activityDuration = activity.duration || 120;

    // Populate modal content
    activityTitle.textContent = activity.title;
    selectedDate.textContent = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Reset form
    document.getElementById('event-start-time').value = '09:00';
    document.getElementById('event-notes').value = '';

    modal.classList.add('active');
}

async function handleTimeSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const activityId = form.dataset.activityId;
    const selectedDate = new Date(form.dataset.selectedDate);
    const duration = parseInt(form.dataset.activityDuration);
    const startTime = document.getElementById('event-start-time').value;
    const notes = document.getElementById('event-notes').value;

    // Find the activity to get its details
    const activity = activities.find(a => a.id == activityId);
    if (!activity) {
        showToast('Activity not found', 'error');
        return;
    }

    try {
        showLoading();

        // Parse the time and create start date
        const [hours, minutes] = startTime.split(':').map(Number);
        const startDate = new Date(selectedDate);
        startDate.setHours(hours, minutes, 0, 0);

        // Calculate end date based on duration
        const endDate = new Date(startDate);
        endDate.setMinutes(endDate.getMinutes() + duration);

        // Create the event data
        const eventData = {
            activity_id: activityId,
            title: activity.title,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            notes: notes || ''
        };

        const response = await fetch('/api/calendar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        });

        if (!response.ok) throw new Error('Failed to create event'); const createdEvent = await response.json(); closeModal('time-modal'); console.log('Event created, loading calendar events...'); // Debug log
        await loadCalendarEvents();
        await loadActivityHistory(); // Refresh activity history
        console.log('Calendar events loaded, rendering components...'); // Debug log
        renderCalendar();
        renderActivitiesList(); // Update activities sidebar to remove scheduled activity
        console.log('Activities list rendered'); // Debug log
        renderActivitiesGrid(); // Update activities grid to reflect scheduled activities
        console.log('Activities grid rendered'); // Debug log
        renderHistoryGrid(); // Update history to show new scheduled activity
        console.log('History grid rendered'); // Debug log
        updateStats();

        // Show confirmation modal with event details
        console.log('Showing event confirmation modal'); // Debug log
        showEventConfirmation(createdEvent, activity, startDate, endDate);
    } catch (error) {
        console.error('Error creating event:', error);
        showToast('Failed to schedule activity', 'error');
    } finally {
        hideLoading();
    }
}

// Show event details
function showEventDetails(event) {
    const modal = document.getElementById('event-modal');

    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);
    const activity = activities.find(a => a.id == event.activity_id);

    // Update modal title
    document.getElementById('event-modal-title').textContent = 'Event Details';

    // Update event image
    const eventImage = document.getElementById('event-image');
    const imagePlaceholder = document.getElementById('event-image-placeholder');

    if (activity && activity.image_url) {
        eventImage.src = activity.image_url;
        eventImage.style.display = 'block';
        imagePlaceholder.style.display = 'none';
    } else {
        eventImage.style.display = 'none';
        imagePlaceholder.style.display = 'flex';
    }

    // Update event title
    document.getElementById('event-title').textContent = event.title;    // Update category badge
    const categoryBadge = document.getElementById('event-category');
    if (event.category) {
        categoryBadge.textContent = `Category: ${event.category}`;
        categoryBadge.className = `category-badge category-${event.category.toLowerCase().replace(/\s+/g, '-').replace('&', '')}`;
        categoryBadge.style.display = 'inline-block';
    } else {
        categoryBadge.style.display = 'none';
    }

    // Update excitement badge
    const excitementBadge = document.getElementById('event-excitement');
    if (activity && activity.excitement > 0) {
        excitementBadge.textContent = `Excitement: ${activity.excitement}/10`;
        excitementBadge.style.display = 'inline-flex';
    } else {
        excitementBadge.style.display = 'none';
    }// Update time
    document.getElementById('event-time').textContent =
        `${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    // Update location with clickable link
    const locationRow = document.getElementById('event-location-row');
    const locationSpan = document.getElementById('event-location');
    const location = (activity && activity.location) || event.location || event.activity_location || event.address || '';
    if (location) {
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
        locationSpan.innerHTML = `<a href="${googleMapsUrl}" target="_blank" class="location-link">${location} <i class="fas fa-external-link-alt"></i></a>`;
        locationRow.style.display = 'flex';
    } else {
        locationRow.style.display = 'none';
    }

    // Update duration
    const durationMinutes = Math.round((endDate - startDate) / (1000 * 60));
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    let durationText = '';
    if (hours > 0) {
        durationText = hours === 1 ? `${hours} hour` : `${hours} hours`;
        if (minutes > 0) {
            durationText += ` and ${minutes} minutes`;
        }
    } else {
        durationText = minutes === 1 ? `${minutes} minute` : `${minutes} minutes`;
    }
    document.getElementById('event-duration').textContent = durationText;

    // Update cost
    const costRow = document.getElementById('event-cost-row');
    const costSpan = document.getElementById('event-cost');
    if (activity && activity.estimated_cost > 0) {
        costSpan.textContent = `$${activity.estimated_cost.toFixed(2)}`;
        costRow.style.display = 'flex';
    } else {
        costRow.style.display = 'none';
    }

    // Update notes/description
    const notesRow = document.getElementById('event-notes-row');
    const notesSpan = document.getElementById('event-notes');
    let notesText = '';

    if (event.notes && event.notes.trim()) {
        notesText = event.notes.trim();
    } else if (activity && activity.description && activity.description.trim()) {
        notesText = activity.description.trim();
    }

    if (notesText) {
        notesSpan.textContent = notesText;
        notesRow.style.display = 'flex';
    } else {
        notesRow.style.display = 'none';
    }

    // Remove the old description div (since we're now using the notes row)
    const descriptionDiv = document.getElementById('event-description');
    if (descriptionDiv) {
        descriptionDiv.style.display = 'none';
    }

    // Set up action buttons
    const editBtn = document.getElementById('edit-event-btn');
    const deleteBtn = document.getElementById('delete-event-btn');
    const completeBtn = document.getElementById('complete-event-btn');

    // Remove any existing event listeners
    editBtn.replaceWith(editBtn.cloneNode(true));
    deleteBtn.replaceWith(deleteBtn.cloneNode(true));
    completeBtn.replaceWith(completeBtn.cloneNode(true));

    // Get the new button references
    const newEditBtn = document.getElementById('edit-event-btn');
    const newDeleteBtn = document.getElementById('delete-event-btn');
    const newCompleteBtn = document.getElementById('complete-event-btn');

    // Update complete button text and icon
    if (event.completed) {
        newCompleteBtn.innerHTML = '<i class="fas fa-undo"></i> Mark Incomplete';
        newCompleteBtn.className = 'btn-secondary';
    } else {
        newCompleteBtn.innerHTML = '<i class="fas fa-check"></i> Mark Complete';
        newCompleteBtn.className = 'btn-success';
    }

    // Hide buttons for archived events
    if (event.is_archived) {
        newEditBtn.style.display = 'none';
        newDeleteBtn.style.display = 'none';
        newCompleteBtn.innerHTML = '<i class="fas fa-archive"></i> Archived';
        newCompleteBtn.className = 'btn-secondary';
        newCompleteBtn.disabled = true;
    } else {
        newEditBtn.style.display = 'flex';
        newDeleteBtn.style.display = 'flex';
        newCompleteBtn.disabled = false;
    }

    // Add event listeners
    if (!event.is_archived && activity) {
        newEditBtn.addEventListener('click', () => {
            closeModal('event-modal');
            editActivity(activity.id);
        });
    }

    if (!event.is_archived) {
        newDeleteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this event?')) {
                deleteEvent(event.id);
            }
        });

        newCompleteBtn.addEventListener('click', () => {
            toggleEventCompletion(event.id, !event.completed);
        });
    }

    modal.classList.add('active');
}

// Toggle event completion
async function toggleEventCompletion(eventId, completed) {
    try {
        // Get the event details before updating
        const event = calendarEvents.find(e => e.id == eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        const response = await fetch(`/api/calendar/${eventId}/complete`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ completed })
        });

        if (!response.ok) throw new Error('Failed to update event');

        // If marking as completed and has an associated activity, add to history
        if (completed && event.activity_id) {
            const activity = activities.find(a => a.id == event.activity_id);
            if (activity) {
                await addToActivityHistory(event, activity);
            }
        }

        showToast(completed ? 'Event marked as complete!' : 'Event marked as incomplete!', 'success');
        closeModal('event-modal');
        await loadCalendarEvents();
        await loadActivityHistory(); // Reload history to show new completed activity
        renderCalendar();
        renderHistoryGrid(); // Update history to reflect completion status
        updateStats();
    } catch (error) {
        console.error('Error updating event:', error);
        showToast('Failed to update event', 'error');
    }
}

// Delete event
async function deleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event?')) {
        return;
    }

    try {
        const response = await fetch(`/api/calendar/${eventId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete event');

        showToast('Event deleted successfully!', 'success');
        closeModal('event-modal');
        await loadCalendarEvents();
        renderCalendar();
        renderActivitiesList(); // Update sidebar to show unscheduled activities again
        renderActivitiesGrid(); // Update activities grid
        renderHistoryGrid(); // Update history to reflect deleted event
        updateStats();
    } catch (error) {
        console.error('Error deleting event:', error);
        showToast('Failed to delete event', 'error');
    }
}

// Show event confirmation modal
function showEventConfirmation(event, activity, startDate, endDate) {
    const modal = document.getElementById('event-confirmation-modal');
    const detailsContainer = document.getElementById('event-confirmation-details');

    // Get the activity details to ensure we have all information including address
    const fullActivity = activities.find(a => a.id === activity.id) || activity;

    detailsContainer.innerHTML = `
        <div style="padding: 1rem 0;">
            <h4 style="color: var(--primary-color); margin-bottom: 1rem;">
                <i class="fas fa-calendar-check"></i> ${event.title || activity.title}
            </h4>
            <div style="margin: 1rem 0; line-height: 1.8;">
                <div style="margin-bottom: 0.5rem;">
                    <strong><i class="fas fa-calendar-day" style="color: var(--text-secondary); margin-right: 0.5rem;"></i>Date:</strong> 
                    ${startDate.toLocaleDateString()}
                </div>
                <div style="margin-bottom: 0.5rem;">
                    <strong><i class="fas fa-clock" style="color: var(--text-secondary); margin-right: 0.5rem;"></i>Time:</strong> 
                    ${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}
                </div>                ${fullActivity.location && fullActivity.location !== 'See Google Maps link' && fullActivity.location !== 'See link for details' ? `
                    <div style="margin-bottom: 0.5rem;">
                        <i class="fas fa-map-marker-alt" style="color: var(--text-secondary); margin-right: 0.5rem;"></i>
                        ${createAddressLink(fullActivity)}
                    </div>
                ` : ''}
                ${fullActivity.category ? `
                    <div style="margin-bottom: 0.5rem;">
                        <strong><i class="fas fa-tag" style="color: var(--text-secondary); margin-right: 0.5rem;"></i>Category:</strong> 
                        ${fullActivity.category}
                    </div>
                ` : ''}
                ${event.notes ? `
                    <div style="margin-bottom: 0.5rem;">
                        <strong><i class="fas fa-sticky-note" style="color: var(--text-secondary); margin-right: 0.5rem;"></i>Notes:</strong> 
                        ${event.notes}
                    </div>
                ` : ''}
            </div>
            <div style="padding: 1rem; background: var(--bg-secondary); border-radius: var(--border-radius); margin-top: 1rem;">
                <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">
                    <i class="fas fa-info-circle" style="margin-right: 0.5rem;"></i>
                    Your event has been added to the calendar. Click "Jump to Event" to see it highlighted on the calendar.
                </p>
            </div>
        </div>
    `;    // Add event listeners to the buttons
    const jumpBtn = document.getElementById('jump-to-event-btn');

    if (jumpBtn) {
        jumpBtn.onclick = () => {
            // Switch to calendar tab first
            switchTab('planner');
            jumpToEvent(event.id || event.activity_id, startDate);
            closeModal('event-confirmation-modal');
            showToast('Jumping to your scheduled event!', 'info');
        };
    }

    // Re-attach event listeners for close buttons in this modal
    const closeButtons = modal.querySelectorAll('.modal-close, .btn-secondary');
    closeButtons.forEach(btn => {
        // Remove any existing onclick to avoid conflicts
        btn.onclick = null;
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Event confirmation modal close button clicked (dynamic)'); // Debug log
            closeModal('event-confirmation-modal');
        });
    });

    modal.classList.add('active');
}

// Jump to event and highlight it
function jumpToEvent(eventId, eventDate) {
    // Switch to the correct month/year if needed
    const eventYear = eventDate.getFullYear();
    const eventMonth = eventDate.getMonth();

    if (currentDate.getFullYear() !== eventYear || currentDate.getMonth() !== eventMonth) {
        currentDate.setFullYear(eventYear);
        currentDate.setMonth(eventMonth);
        currentDate.setDate(eventDate.getDate()); // Set the day as well for week view
        renderCalendar();
    }

    // Wait for calendar to render, then highlight the event
    setTimeout(() => {
        // Find the calendar day that contains this event
        const dayElement = document.querySelector(`[data-date="${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}"]`);

        if (dayElement) {
            // Highlight the day
            dayElement.classList.add('highlighted-day');

            // Find the specific event within that day
            const eventElement = dayElement.querySelector(`[data-event-id="${eventId}"]`);
            if (eventElement) {
                eventElement.classList.add('highlighted');

                // Scroll the event into view
                eventElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'center'
                });
            }

            // Scroll the day into view
            dayElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });

            // Remove highlights after animation completes
            setTimeout(() => {
                dayElement.classList.remove('highlighted-day');
                if (eventElement) {
                    eventElement.classList.remove('highlighted');
                }
            }, 3000);
        }
    }, 100);
}

// Mark event as complete
async function markEventComplete(eventId) {
    try {
        showLoading(); const response = await fetch(`/api/calendar/${eventId}/complete`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ completed: true })
        });

        if (!response.ok) throw new Error('Failed to mark event as complete');

        showToast('Event marked as complete!', 'success');

        // Refresh all data
        await loadCalendarEvents();
        await loadActivityHistory();
        renderCalendar();
        renderActivitiesList();
        renderActivitiesGrid();
        renderHistoryGrid();
        updateStats();

    } catch (error) {
        console.error('Error marking event as complete:', error);
        showToast('Failed to mark event as complete', 'error');
    } finally {
        hideLoading();
    }
}

// Update statistics
function updateStats() {
    const totalActivities = activities.length;
    const plannedActivities = calendarEvents.length;
    const completedActivities = calendarEvents.filter(event => event.completed).length;

    document.getElementById('total-activities').textContent = totalActivities;
    document.getElementById('planned-activities').textContent = plannedActivities;
    document.getElementById('completed-activities').textContent = completedActivities;
}

// Utility functions
function showLoading() {
    document.getElementById('loading-spinner').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading-spinner').classList.remove('active');
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? 'check-circle' :
        type === 'error' ? 'exclamation-circle' :
            'exclamation-triangle';
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;

    const toastContainer = document.getElementById('toast-container');
    toastContainer.appendChild(toast);
    // Remove toast after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Helper function to create clickable location link
function createLocationLink(activity) {
    if (!activity.location) return '';

    // Check if the activity has a URL that looks like Google Maps
    const isGoogleMapsUrl = activity.url && (
        activity.url.includes('google.com/maps') ||
        activity.url.includes('maps.google') ||
        activity.url.includes('g.co/kgs') ||
        activity.url.includes('maps.app.goo.gl')
    ); if (isGoogleMapsUrl) {
        // Use the original Google Maps URL
        return `
            <div class="activity-location">
                <a href="${activity.url}" target="_blank" rel="noopener noreferrer" class="location-link" title="Open in Google Maps">
                    ${activity.location}
                </a>
            </div>
        `;
    } else if (activity.location && activity.location !== 'See Google Maps link' && activity.location !== 'See link for details') {
        // Create a Google Maps search URL for the address
        const encodedLocation = encodeURIComponent(activity.location);
        const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;

        return `
            <div class="activity-location">
                <a href="${mapsSearchUrl}" target="_blank" rel="noopener noreferrer" class="location-link" title="Search in Google Maps">
                    ${activity.location}
                </a>
            </div>
        `;
    } else {
        // Fallback for non-specific locations
        return `
            <div class="activity-location">
                <span class="location-text">${activity.location}</span>
            </div>
        `;
    }
}

// Helper function to create clickable location for large cards
function createLocationDetail(activity) {
    if (!activity.location) return '';

    // Check if the activity has a URL that looks like Google Maps
    const isGoogleMapsUrl = activity.url && (
        activity.url.includes('google.com/maps') ||
        activity.url.includes('maps.google') ||
        activity.url.includes('g.co/kgs') ||
        activity.url.includes('maps.app.goo.gl')
    );

    if (isGoogleMapsUrl) {
        // Use the original Google Maps URL
        return `
            <div class="activity-detail">
                <i class="fas fa-map-marker-alt"></i>
                <a href="${activity.url}" target="_blank" rel="noopener noreferrer" class="location-link" title="Open in Google Maps">
                    ${activity.location}
                    <i class="fas fa-external-link-alt location-link-icon"></i>
                </a>
            </div>
        `;
    } else if (activity.location && activity.location !== 'See Google Maps link' && activity.location !== 'See link for details') {
        // Create a Google Maps search URL for the address
        const encodedLocation = encodeURIComponent(activity.location);
        const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;

        return `
            <div class="activity-detail">
                <i class="fas fa-map-marker-alt"></i>
                <a href="${mapsSearchUrl}" target="_blank" rel="noopener noreferrer" class="location-link" title="Search in Google Maps">
                    ${activity.location}
                    <i class="fas fa-external-link-alt location-link-icon"></i>
                </a>
            </div>
        `;
    } else {
        // Fallback for non-specific locations
        return `
            <div class="activity-detail">
                <i class="fas fa-map-marker-alt"></i>
                <span class="location-text">${activity.location}</span>
            </div>
        `;
    }
}

// Helper function to create clickable location for event details modal
function createEventLocationDetail(activity) {
    if (!activity.location) return '';

    // Check if the activity has a URL that looks like Google Maps
    const isGoogleMapsUrl = activity.url && (
        activity.url.includes('google.com/maps') ||
        activity.url.includes('maps.google') ||
        activity.url.includes('g.co/kgs') ||
        activity.url.includes('maps.app.goo.gl')
    );

    if (isGoogleMapsUrl) {
        // Use the original Google Maps URL
        return `<strong>Location:</strong> <a href="${activity.url}" target="_blank" rel="noopener noreferrer" class="location-link" title="Open in Google Maps">${activity.location} <i class="fas fa-external-link-alt"></i></a><br>`;
    } else if (activity.location && activity.location !== 'See Google Maps link' && activity.location !== 'See link for details') {
        // Create a Google Maps search URL for the address
        const encodedLocation = encodeURIComponent(activity.location);
        const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;

        return `<strong>Location:</strong> <a href="${mapsSearchUrl}" target="_blank" rel="noopener noreferrer" class="location-link" title="Search in Google Maps">${activity.location} <i class="fas fa-external-link-alt"></i></a><br>`;
    } else {
        // Fallback for non-specific locations
        return `<strong>Location:</strong> ${activity.location}<br>`;
    }
}

// Helper function to create clickable location for event confirmation modal
function createAddressLink(activity) {
    if (!activity.location) return '';

    // Check if the activity has a URL that looks like Google Maps
    const isGoogleMapsUrl = activity.url && (
        activity.url.includes('google.com/maps') ||
        activity.url.includes('maps.google') ||
        activity.url.includes('g.co/kgs') ||
        activity.url.includes('maps.app.goo.gl')
    );

    if (isGoogleMapsUrl) {
        // Use the original Google Maps URL
        return `<strong>Location:</strong> <a href="${activity.url}" target="_blank" rel="noopener noreferrer" class="location-link" title="Open in Google Maps">${activity.location} <i class="fas fa-external-link-alt"></i></a>`;
    } else if (activity.location && activity.location !== 'See Google Maps link' && activity.location !== 'See link for details') {
        // Create a Google Maps search URL for the address
        const encodedLocation = encodeURIComponent(activity.location);
        const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;

        return `<strong>Location:</strong> <a href="${mapsSearchUrl}" target="_blank" rel="noopener noreferrer" class="location-link" title="Search in Google Maps">${activity.location} <i class="fas fa-external-link-alt"></i></a>`;
    } else {
        // Fallback for non-specific locations
        return `<strong>Location:</strong> ${activity.location}`;
    }
}

// Move completed activity back to ideas
// Add completed activity to history
async function addToActivityHistory(event, activity) {
    try {
        const historyData = {
            original_activity_id: activity.id,
            title: activity.title,
            description: activity.description,
            category: activity.category,
            location: activity.location,
            duration: activity.duration,
            url: activity.url,
            image_url: activity.image_url,
            estimated_cost: activity.estimated_cost,
            excitement: activity.excitement,
            completed_date: new Date().toISOString(),
            event_start_date: event.start_date,
            event_end_date: event.end_date,
            event_notes: event.notes
        };

        const response = await fetch('/api/history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(historyData)
        });

        if (!response.ok) {
            console.error('Failed to add to activity history');
        }
    } catch (error) {
        console.error('Error adding to activity history:', error);
    }
}

// Move history item back to ideas
async function moveHistoryItemBackToIdeas(historyId) {
    if (!confirm('Are you sure you want to move this completed activity back to your ideas? This will create a new activity based on this completed activity.')) {
        return;
    }

    try {
        showLoading();

        const response = await fetch(`/api/history/${historyId}/move-to-ideas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Failed to move activity back to ideas');

        const result = await response.json();
        showToast('Activity moved back to ideas successfully!', 'success');

        // Refresh all views
        await loadActivities();
        renderActivitiesList(); // This will now show the new activity
        renderActivitiesGrid(); // This will now show the new activity
        updateStats();
    } catch (error) {
        console.error('Error moving activity back to ideas:', error);
        showToast('Failed to move activity back to ideas', 'error');
    } finally {
        hideLoading();
    }
}

// Delete history item
async function deleteHistoryItem(historyId) {
    if (!confirm('Are you sure you want to delete this completed activity from your history? This action cannot be undone.')) {
        return;
    }

    try {
        showLoading();

        const response = await fetch(`/api/history/${historyId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete history item');

        showToast('History item deleted successfully!', 'success');

        // Refresh all data
        await loadActivityHistory();
        renderHistoryGrid();
        updateStats();

    } catch (error) {
        console.error('Error deleting history item:', error);
        showToast('Failed to delete history item', 'error');
    } finally {
        hideLoading();
    }
}

// Show history details
function showHistoryDetails(historyItem) {
    const modal = document.getElementById('event-modal');
    const detailsContainer = document.getElementById('event-details');

    const completedDate = new Date(historyItem.completed_date);
    const eventStartDate = new Date(historyItem.event_start_date);
    const eventEndDate = new Date(historyItem.event_end_date);

    detailsContainer.innerHTML = `
        <div style="padding: 1.5rem;">
            <h4>${historyItem.title}</h4>
            <div style="margin: 1rem 0; line-height: 1.8;">
                <strong>Original Event Date:</strong> ${eventStartDate.toLocaleDateString()}<br>
                <strong>Original Event Time:</strong> ${eventStartDate.toLocaleTimeString()} - ${eventEndDate.toLocaleTimeString()}<br>
                <strong>Completed On:</strong> ${completedDate.toLocaleDateString()} at ${completedDate.toLocaleTimeString()}<br>
                ${historyItem.location && historyItem.location !== 'See Google Maps link' && historyItem.location !== 'See link for details' ?
            `<strong><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(historyItem.location)}" target="_blank" rel="noopener noreferrer" class="location-link">${historyItem.location}</a></strong><br>` : ''}
                ${historyItem.category ? `<strong>Category:</strong> ${historyItem.category}<br>` : ''}
                ${historyItem.description ? `<strong>Description:</strong> ${historyItem.description}<br>` : ''}
                ${historyItem.event_notes ? `<strong>Event Notes:</strong> ${historyItem.event_notes}<br>` : ''}
                ${historyItem.duration ? `<strong>Duration:</strong> ${historyItem.duration} minutes<br>` : ''}
                ${historyItem.estimated_cost ? `<strong>Estimated Cost:</strong> $${historyItem.estimated_cost}<br>` : ''}
                ${historyItem.excitement > 0 ? `<strong>Excitement:</strong> ${historyItem.excitement}/10<br>` : ''}
            </div>
            <div style="display: flex; gap: 1rem; justify-content: flex-end; flex-wrap: wrap;">
                <button class="btn-warning" id="move-back-btn">
                    <i class="fas fa-undo"></i> Move Back to Ideas
                </button>
                ${historyItem.url ? `
                    <a href="${historyItem.url}" target="_blank" class="btn-secondary">
                        <i class="fas fa-external-link-alt"></i> Visit Link
                    </a>
                ` : ''}
            </div>
        </div>
    `;

    // Add event listener for move back button
    const moveBackBtn = detailsContainer.querySelector('#move-back-btn');
    if (moveBackBtn) {
        moveBackBtn.addEventListener('click', () => {
            closeModal('event-modal');
            moveHistoryItemBackToIdeas(historyItem.id);
        });
    }

    modal.classList.add('active');
}

// Make additional functions globally accessible for onclick handlers
window.editActivity = editActivity;
window.deleteActivity = deleteActivity;
window.toggleEventCompletion = toggleEventCompletion;
window.deleteEvent = deleteEvent;
window.moveHistoryItemBackToIdeas = moveHistoryItemBackToIdeas;
window.showHistoryDetails = showHistoryDetails;
