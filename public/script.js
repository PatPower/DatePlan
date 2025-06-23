// Global state
let currentDate = new Date();
let currentView = 'month';
let activities = [];
let categories = [];
let calendarEvents = [];
let draggedActivity = null;

// DOM elements will be assigned after DOM loads
let activityModal, eventModal, timeModal, loadingSpinner, toastContainer;

// Define critical functions early for global access
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Make functions globally accessible for onclick handlers immediately
window.closeModal = closeModal;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function () {    // Assign DOM elements after DOM is loaded
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
    });    // Activity form
    document.getElementById('activity-form').addEventListener('submit', handleActivitySubmit);

    // Time form
    document.getElementById('time-form').addEventListener('submit', handleTimeSubmit);

    // URL parser
    document.getElementById('parse-url-btn').addEventListener('click', handleParseUrl);    // Search and filter
    document.getElementById('activity-search').addEventListener('input', filterActivities);
    document.getElementById('category-filter').addEventListener('change', filterActivities);

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function () {
            const modal = this.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // Modal close on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function (e) {
            if (e.target === this) {
                closeModal(this.id);
            }
        });
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
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Refresh data if switching to activities tab
    if (tabName === 'activities') {
        renderActivitiesGrid();
    }
}

// Load all data
async function loadData() {
    try {
        await Promise.all([
            loadActivities(),
            loadCalendarEvents()
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
        if (!response.ok) throw new Error('Failed to load activities');
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
        const response = await fetch('/api/calendar');
        if (!response.ok) throw new Error('Failed to load calendar events');
        calendarEvents = await response.json();
    } catch (error) {
        console.error('Error loading calendar events:', error);
        calendarEvents = [];
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

    return dayElement;
}

// Create event element
function createEventElement(event) {
    const eventEl = document.createElement('div');
    eventEl.className = 'calendar-event';
    if (event.completed) {
        eventEl.classList.add('completed');
    }

    // Get category color
    const category = categories.find(c => c.name === event.category);
    if (category) {
        eventEl.style.backgroundColor = category.color;
    }

    const startTime = new Date(event.start_date).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    eventEl.innerHTML = `
        <i class="fas fa-clock"></i>
        <span>${startTime} - ${event.title}</span>
    `;

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

    if (!draggedActivity) return;

    // Open time selection modal instead of directly creating event
    openTimeModal(draggedActivity, date);
}

// Render activities list (sidebar)
function renderActivitiesList() {
    const container = document.getElementById('activities-list');
    const filteredActivities = getFilteredActivities();

    container.innerHTML = '';

    if (filteredActivities.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-light); padding: 2rem;">No activities found</div>';
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
    const categoryClass = activity.category.toLowerCase().replace(/[^a-z0-9]/g, '-'); card.innerHTML = `
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
        ${activity.location ? `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem;"><i class="fas fa-map-marker-alt"></i> ${activity.location}</div>` : ''}
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

    activities.forEach(activity => {
        const activityCard = createActivityCardLarge(activity);
        container.appendChild(activityCard);
    });
}

// Create large activity card for activities tab
function createActivityCardLarge(activity) {
    const card = document.createElement('div');
    card.className = 'activity-card-large';

    const category = categories.find(c => c.name === activity.category) || { color: '#6366f1' };
    const categoryClass = activity.category.toLowerCase().replace(/[^a-z0-9]/g, '-');

    card.innerHTML = `
        <div class="activity-title">${activity.title}</div>
        <div class="activity-category category-${categoryClass}">${activity.category}</div>
        ${activity.description ? `<div class="activity-description">${activity.description}</div>` : ''}
        <div class="activity-details">
            ${activity.location ? `<div class="activity-detail"><i class="fas fa-map-marker-alt"></i> ${activity.location}</div>` : ''}
            <div class="activity-detail"><i class="fas fa-clock"></i> ${activity.duration || 120} minutes</div>
            <div class="activity-detail"><i class="fas fa-dollar-sign"></i> $${activity.estimated_cost || 0}</div>
            ${activity.rating > 0 ? `<div class="activity-detail"><i class="fas fa-star"></i> ${activity.rating}/5</div>` : ''}
        </div>        <div class="activity-card-actions">
            <button class="btn-secondary btn-small edit-large-btn" data-activity-id="${activity.id}">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn-secondary btn-small delete-large-btn" data-activity-id="${activity.id}">
                <i class="fas fa-trash"></i> Delete
            </button>
            ${activity.url ? `<a href="${activity.url}" target="_blank" class="btn-secondary btn-small">
                <i class="fas fa-external-link-alt"></i> Visit
            </a>` : ''}
        </div>
    `;

    // Add event listeners for action buttons
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
    }

    return card;
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
    document.getElementById('activity-rating').value = activity.rating || 0;
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
        rating: parseFloat(document.getElementById('activity-rating').value)
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

        if (!response.ok) throw new Error('Failed to save activity');

        showToast(isEdit ? 'Activity updated successfully!' : 'Activity created successfully!', 'success');
        closeModal('activity-modal');
        await loadActivities();
        renderActivitiesList();
        renderActivitiesGrid();
        updateStats();
    } catch (error) {
        console.error('Error saving activity:', error);
        showToast('Failed to save activity', 'error');
    } finally {
        hideLoading();
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

        if (!response.ok) throw new Error('Failed to parse URL');

        const data = await response.json();
        // Populate form fields with parsed data
        if (data.title) document.getElementById('activity-title').value = data.title;
        if (data.description) document.getElementById('activity-description').value = data.description;
        if (data.category) document.getElementById('activity-category').value = data.category;
        if (data.location) document.getElementById('activity-location').value = data.location;
        if (data.duration) document.getElementById('activity-duration').value = data.duration;
        if (data.image_url) document.getElementById('activity-image').value = data.image_url;
        if (data.estimated_cost) document.getElementById('activity-cost').value = data.estimated_cost;
        if (data.rating && data.rating > 0) document.getElementById('activity-rating').value = data.rating;

        // Show success message with source info
        let successMessage = 'Activity details filled automatically!';
        if (data.source) {
            successMessage = `Details extracted from ${data.source}!`;
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

        if (!response.ok) throw new Error('Failed to delete activity');

        showToast('Activity deleted successfully!', 'success');
        await loadActivities();
        renderActivitiesList();
        renderActivitiesGrid();
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
        
        if (!response.ok) throw new Error('Failed to create event');
        
        showToast('Activity scheduled successfully!', 'success');
        closeModal('time-modal');
        await loadCalendarEvents();
        renderCalendar();
        updateStats();
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
    const detailsContainer = document.getElementById('event-details');

    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);

    detailsContainer.innerHTML = `
        <div style="padding: 1.5rem;">
            <h4>${event.title}</h4>
            <div style="margin: 1rem 0;">
                <strong>Date:</strong> ${startDate.toLocaleDateString()}<br>
                <strong>Time:</strong> ${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}<br>
                ${event.location ? `<strong>Location:</strong> ${event.location}<br>` : ''}
                ${event.category ? `<strong>Category:</strong> ${event.category}<br>` : ''}
                ${event.notes ? `<strong>Notes:</strong> ${event.notes}<br>` : ''}
            </div>
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button class="btn-secondary" id="toggle-completion-btn">
                    <i class="fas fa-${event.completed ? 'undo' : 'check'}"></i>
                    ${event.completed ? 'Mark Incomplete' : 'Mark Complete'}
                </button>
                <button class="btn-secondary" id="delete-event-btn">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;

    // Add event listeners to the buttons
    const toggleBtn = detailsContainer.querySelector('#toggle-completion-btn');
    const deleteBtn = detailsContainer.querySelector('#delete-event-btn');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            toggleEventCompletion(event.id, !event.completed);
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            deleteEvent(event.id);
        });
    }

    modal.classList.add('active');
}

// Toggle event completion
async function toggleEventCompletion(eventId, completed) {
    try {
        const response = await fetch(`/api/calendar/${eventId}/complete`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ completed })
        });

        if (!response.ok) throw new Error('Failed to update event');

        showToast(completed ? 'Event marked as complete!' : 'Event marked as incomplete!', 'success');
        closeModal('event-modal');
        await loadCalendarEvents();
        renderCalendar();
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
        updateStats();
    } catch (error) {
        console.error('Error deleting event:', error);
        showToast('Failed to delete event', 'error');
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

// Make additional functions globally accessible for onclick handlers
window.editActivity = editActivity;
window.deleteActivity = deleteActivity;
window.toggleEventCompletion = toggleEventCompletion;
window.deleteEvent = deleteEvent;
