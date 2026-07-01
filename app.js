// ============================================
// AKRADA — CAMPUS INTELLIGENCE PLATFORM
// Built by Okami Nalado
// ============================================

class AkradaApp {
    constructor() {
        // Supabase Configuration
        this.SUPABASE_URL = 'https://zqrypacphktexslfjylx.supabase.co';
        this.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxcnlwYWNwaGt0ZXhzbGZqeWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4OTQyNDIsImV4cCI6MjA5NTQ3MDI0Mn0.jgeqZ0Qc4ztimJtjuvkL0Q8fY7qVYL5NLARy3PNxdGg';
        
        // State
        this.supabase = null;
        this.currentUser = null;
        this.currentSchool = null;
        this.currentSchoolId = null;
        this.map = null;
        this.locations = [];
        this.userLocationMarker = null;
        this.activeMarker = null;
        this.searchHistory = [];
        this.recentlyViewed = [];
        this.isInstalled = false;
        this.isOnline = navigator.onLine;
        this.currentView = 'map';
        this.userHeading = 0;
        
        // Campus partner mapping
        this.partnerCampuses = ['unijos']; // Campuses with student partners
        
        // Init
        this.init();
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    async init() {
        this.showLoading(false);
        this.loadSearchHistory();
        this.loadRecentlyViewed();
        
        try {
            await this.initializeSupabase();
            await this.checkAuthState();
            this.setupEventListeners();
            this.initInstallBanner();
            this.initNetworkDetection();
            
            setTimeout(() => this.showLoading(true), 1500);
        } catch (err) {
            console.error('Init failed:', err);
            this.showLoading(true);
        }
    }

    async initializeSupabase() {
        if (!window.supabase) {
            throw new Error('Supabase SDK failed to load. Check CDN connection.');
        }
        
        if (!this.SUPABASE_URL.includes('supabase.co') || this.SUPABASE_ANON_KEY === 'YOUR_ANON_KEY_HERE') {
            throw new Error('Missing Supabase credentials.');
        }

        try {
            this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
            console.log('✅ Supabase client initialized');
        } catch (err) {
            console.error('❌ Supabase init failed:', err);
            throw err;
        }
    }

    async checkAuthState() {
        const { data: { session }, error } = await this.supabase.auth.getSession();
        
        if (session) {
            this.currentUser = session.user;
            await this.loadUserProfile();
            this.showMainApp();
        } else {
            this.showLoginScreen();
        }
    }

    // ============================================
    // NETWORK DETECTION
    // ============================================
    initNetworkDetection() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.hideOfflineBanner();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showOfflineBanner();
        });
        
        if (!this.isOnline) {
            this.showOfflineBanner();
        }
    }

    showOfflineBanner() {
        const banner = document.getElementById('offline-banner');
        if (banner) banner.classList.remove('hidden');
    }

    hideOfflineBanner() {
        const banner = document.getElementById('offline-banner');
        if (banner) banner.classList.add('hidden');
    }

    // ============================================
    // LOADING SCREEN
    // ============================================
    showLoading(hide) {
        const loader = document.getElementById('loading-screen');
        if (!loader) return;
        
        if (hide) {
            loader.classList.add('fade-out');
            setTimeout(() => {
                loader.classList.add('hidden');
            }, 500);
        } else {
            loader.classList.remove('hidden');
            loader.classList.remove('fade-out');
        }
    }

    // ============================================
    // TOAST NOTIFICATIONS
    // ============================================
    showToast(message) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3000);
    }

    // ============================================
    // AUTHENTICATION
    // ============================================
    async handleLogin(e) {
        e.preventDefault();
        if (!this.supabase) return alert('System not ready. Please refresh.');
        
        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');
    
        try {
            const { error } = await this.supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            await this.checkAuthState();
        } catch (error) {
            alert(`Login failed: ${error.message}`);
        }
    }
    
    async handleSignup(e) {
        e.preventDefault();
        if (!this.supabase) return alert('System not ready. Please refresh.');
        
        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        const schoolId = document.getElementById('school-select').value;
        const strugglePlace = formData.get('strugglePlace') || null;
    
        if (password !== confirmPassword) return alert('Passwords do not match.');
        if (!schoolId) return alert('Please select a school.');
    
        try {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { 
                        school_id: schoolId,
                        struggle_place: strugglePlace
                    }
                }
            });
            
            if (error) throw error;
    
            if (data.session) {
                this.currentUser = data.session.user;
                await this.createUserProfile(schoolId, strugglePlace);
                this.showMainApp();
            } else {
                alert('✅ Check your email to confirm your account before logging in.');
                this.showLoginScreen();
            }
        } catch (error) {
            alert(`Signup failed: ${error.message}`);
        }
    }

    async createUserProfile(schoolId, strugglePlace) {
        try {
            const { data: schoolData } = await this.supabase
                .from('schools')
                .select('name')
                .eq('id', schoolId)
                .single();

            const { error } = await this.supabase
                .from('profiles')
                .insert([{
                    id: this.currentUser.id,
                    email: this.currentUser.email,
                    school_id: schoolId,
                    school_name: schoolData?.name,
                    referral_code: this.generateReferralCode(),
                    referral_balance: 0,
                    struggle_place: strugglePlace,
                    created_at: new Date().toISOString()
                }]);

            if (error) throw error;
            
            // Track signup in streaks
            await this.trackAppOpen();
        } catch (error) {
            console.error('Error creating user profile:', error);
        }
    }

    generateReferralCode() {
        return 'AKR' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // ============================================
    // NAVIGATION & VIEWS
    // ============================================
    showLoginScreen() {
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('signup-screen').classList.remove('active');
        document.getElementById('main-app').classList.add('hidden');
    }

    showSignupScreen() {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('signup-screen').classList.add('active');
        document.getElementById('main-app').classList.add('hidden');
    }

    async showMainApp() {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('signup-screen').classList.remove('active');
        document.getElementById('main-app').classList.remove('hidden');
        
        await this.populateSchoolsDropdown();
        await this.loadUserProfile();
        this.initializeMap();
    }

    switchView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Show selected view
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
        }
        
        // Update active menu item
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        const menuItem = document.querySelector(`[data-view="${viewName}"]`);
        if (menuItem) {
            menuItem.classList.add('active');
        }

        // Close sidebar on mobile
        document.getElementById('sidebar-menu').classList.remove('active');

        // Handle special views
        this.currentView = viewName;
        
        switch (viewName) {
            case 'profile':
                this.updateProfileView();
                break;
            case 'referrals':
                this.loadReferralHistory();
                break;
            case 'withdrawals':
                this.loadWithdrawalHistory();
                break;
            case 'about':
                // About view is static — no loading needed
                break;
            case 'support':
                // Support view is static
                break;
            case 'business':
                // Business view is static
                break;
            case 'map':
                if (this.map) {
                    setTimeout(() => this.map.resize(), 300);
                }
                break;
            case 'logout':
                this.handleLogout();
                break;
        }
    }

    // ============================================
    // PROFILE
    // ============================================
    async loadUserProfile() {
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (data) {
                this.currentSchoolId = data.school_id;
                this.currentSchool = data.school_name;
                
                document.getElementById('current-school').textContent = data.school_name || 'Loading...';
                document.getElementById('user-school').textContent = `School: ${data.school_name}`;
                document.getElementById('referral-balance').textContent = data.referral_balance || 0;
                document.getElementById('referral-code').textContent = data.referral_code || '-';
                document.getElementById('withdrawal-balance').textContent = data.referral_balance || 0;
                
                await this.loadSchoolData(data.school_id);
                
                // Show partner badge if campus has a partner
                this.checkPartnerBadge(data.school_id);
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    updateProfileView() {
        if (this.currentUser) {
            document.getElementById('user-name').textContent = this.currentUser.email.split('@')[0];
            document.getElementById('user-email').textContent = this.currentUser.email;
        }
    }

    checkPartnerBadge(schoolId) {
        const badge = document.getElementById('partner-badge');
        if (!badge) return;
        
        // Map school IDs to partner campuses
        const schoolIdMap = {
            'unijos': 'UniJos',
            'kasu': 'KASU',
            'delsu': 'DELSU',
            'atbu': 'ATBU',
            'uniabuja': 'UniAbuja'
        };
        
        const campusName = schoolIdMap[schoolId];
        if (campusName && this.partnerCampuses.includes(schoolId)) {
            document.getElementById('partner-campus-name').textContent = campusName;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    // ============================================
    // SCHOOL DATA
    // ============================================
    async populateSchoolsDropdown() {
        try {
            const { data, error } = await this.supabase
                .from('schools')
                .select('*')
                .order('name');

            if (data) {
                const select = document.getElementById('school-select');
                if (select) {
                    select.innerHTML = '<option value="">Select Your School</option>';
                    
                    data.forEach(school => {
                        const option = document.createElement('option');
                        option.value = school.id;
                        option.textContent = school.name;
                        select.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Error loading schools:', error);
        }
    }

    async loadSchoolData(schoolId) {
        try {
            const { data, error } = await this.supabase
                .from('locations')
                .select('*')
                .eq('school_id', schoolId);

            if (data) {
                this.locations = data;
                if (this.map) {
                    this.addLocationsToMap();
                }
            }
        } catch (error) {
            console.error('Error loading school data:', error);
        }
    }

    // ============================================
    // MAP INITIALIZATION
    // ============================================
    initializeMap() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        const mapContainer = document.getElementById('map');
        if (!mapContainer) return;

        mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN'; // Replace with your actual token
        
        this.map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [7.0361, 9.9347],
            zoom: 13,
            pitch: 0,
            bearing: 0,
            antialias: true
        });

        this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Geolocation with custom white dot
        const geolocate = new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: true,
            showUserHeading: true,
            showAccuracyCircle: true
        });
        
        this.map.addControl(geolocate, 'top-right');

        // Custom user location dot
        this.map.on('load', () => {
            this.addLocationsToMap();
            this.setupUserLocationDot();
        });

        // Handle geolocate events
        geolocate.on('geolocate', (e) => {
            this.userHeading = e.coords.heading || 0;
        });
    }

    setupUserLocationDot() {
        if (!this.map) return;

        // Remove default user location styling and add custom
        const style = document.createElement('style');
        style.textContent = `
            .mapboxgl-user-location-dot {
                background: white !important;
                width: 22px !important;
                height: 22px !important;
                border-radius: 50% !important;
                box-shadow: 0 0 0 3px rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.4) !important;
            }
            .mapboxgl-user-location-dot::after {
                content: '' !important;
                position: absolute !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                width: 44px !important;
                height: 44px !important;
                background: rgba(255,255,255,0.08) !important;
                border-radius: 50% !important;
                animation: userLocationPulse 2s ease-out infinite !important;
                pointer-events: none !important;
            }
            .mapboxgl-user-location-accuracy-circle {
                background: rgba(255,255,255,0.06) !important;
                border: 1px solid rgba(255,255,255,0.15) !important;
            }
            @keyframes userLocationPulse {
                0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.8; }
                100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // ============================================
    // MAP MARKERS
    // ============================================
    addLocationsToMap(filteredLocations = null) {
        if (!this.map) return;

        // Remove existing custom markers
        const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
        existingMarkers.forEach(marker => marker.remove());

        const locations = filteredLocations || this.locations;

        locations.forEach(location => {
            const isVerified = location.is_verified_business || false;
            
            const el = document.createElement('div');
            el.className = 'custom-marker';
            if (isVerified) {
                el.classList.add('verified-business');
            }
            el.setAttribute('data-location-id', location.id);
            el.setAttribute('data-location-name', location.name);

            const marker = new mapboxgl.Marker({
                element: el,
                anchor: 'center'
            })
                .setLngLat([parseFloat(location.longitude), parseFloat(location.latitude)])
                .addTo(this.map);

            // Click handler
            el.addEventListener('click', () => {
                this.handleLocationTap(location, el);
            });

            // Store marker reference
            location._marker = marker;
            location._element = el;
        });
    }

    handleLocationTap(location, element) {
        // Track view
        this.trackLocationView(location);

        // Update active marker styling
        if (this.activeMarker) {
            this.activeMarker.classList.remove('active');
        }
        element.classList.add('active');
        this.activeMarker = element;

        // Add to recently viewed
        this.addToRecentlyViewed(location);

        // Fly to location
        this.map.flyTo({
            center: [parseFloat(location.longitude), parseFloat(location.latitude)],
            zoom: 17,
            duration: 800
        });

        // Show detail card
        this.showLocationDetailCard(location);
    }

    // ============================================
    // LOCATION DETAIL CARD
    // ============================================
    showLocationDetailCard(location) {
        const card = document.getElementById('location-detail-card');
        if (!card) return;

        document.getElementById('location-card-name').textContent = location.name;
        document.getElementById('location-card-category').textContent = location.category || 'General';
        document.getElementById('location-card-description').textContent = 
            location.description || 'No description available.';

        // Popular badge
        const popularBadge = document.getElementById('location-card-popular');
        if (location.view_count > 10) {
            popularBadge.classList.remove('hidden');
        } else {
            popularBadge.classList.add('hidden');
        }

        // Business contact
        const businessSection = document.getElementById('location-card-business');
        const unclaimedSection = document.getElementById('location-card-unclaimed');
        
        if (location.is_verified_business && location.business_phone) {
            businessSection.classList.remove('hidden');
            unclaimedSection.classList.add('hidden');
            document.getElementById('business-phone-number').textContent = location.business_phone;
            document.getElementById('location-card-phone').href = `tel:${location.business_phone}`;
        } else if (location.category === 'restaurants' || location.category === 'printing' || 
                   location.category === 'clinics' || location.category === 'salon' || 
                   location.category === 'kiosk') {
            businessSection.classList.add('hidden');
            unclaimedSection.classList.remove('hidden');
        } else {
            businessSection.classList.add('hidden');
            unclaimedSection.classList.add('hidden');
        }

        // Report link
        document.getElementById('location-report-link').setAttribute('data-location', location.name);

        // Directions button
        document.getElementById('location-directions-btn').onclick = () => {
            this.getDirections(location);
            this.trackDirectionRequest(location);
        };

        // Show card
        card.classList.add('visible');
    }

    hideLocationDetailCard() {
        const card = document.getElementById('location-detail-card');
        if (card) {
            card.classList.remove('visible');
        }
        if (this.activeMarker) {
            this.activeMarker.classList.remove('active');
            this.activeMarker = null;
        }
    }

    getDirections(location) {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const url = `https://www.google.com/maps/dir/?api=1&origin=${position.coords.latitude},${position.coords.longitude}&destination=${location.latitude},${location.longitude}&travelmode=walking`;
                    window.open(url, '_blank');
                },
                () => {
                    alert('Unable to get your location. Please enable location services.');
                }
            );
        } else {
            alert('Geolocation is not supported by your browser.');
        }
    }

    // ============================================
    // SEARCH SYSTEM
    // ============================================
    performSearch(query) {
        const dropdown = document.getElementById('map-search-dropdown');
        const resultsList = document.getElementById('search-results-list');
        const emptyState = document.getElementById('search-empty-state');
        const historySection = document.getElementById('search-history-section');
        const clearBtn = document.getElementById('clear-search-btn');

        if (!dropdown || !resultsList) return;

        if (!query || query.trim() === '') {
            dropdown.classList.add('hidden');
            clearBtn?.classList.add('hidden');
            return;
        }

        query = query.toLowerCase().trim();
        dropdown.classList.remove('hidden');
        clearBtn?.classList.remove('hidden');
        historySection?.classList.add('hidden');

        const results = this.locations.filter(loc => 
            loc.name.toLowerCase().includes(query) ||
            (loc.category && loc.category.toLowerCase().includes(query)) ||
            (loc.description && loc.description.toLowerCase().includes(query))
        );

        resultsList.innerHTML = '';

        if (results.length === 0) {
            emptyState?.classList.remove('hidden');
            resultsList.innerHTML = '';
        } else {
            emptyState?.classList.add('hidden');
            
            results.slice(0, 8).forEach(location => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `
                    <div class="search-result-icon">📍</div>
                    <div class="search-result-info">
                        <div class="search-result-name">${location.name}</div>
                        <div class="search-result-category">${location.category || 'General'}</div>
                    </div>
                `;
                item.addEventListener('click', () => {
                    this.selectSearchResult(location, query);
                });
                resultsList.appendChild(item);
            });
        }

        // Track search
        this.trackSearchQuery(query, results.length);
    }

    selectSearchResult(location, query) {
        // Add to search history
        this.addToSearchHistory(query);

        // Hide dropdown
        document.getElementById('map-search-dropdown').classList.add('hidden');
        document.getElementById('map-search-input').value = '';
        document.getElementById('clear-search-btn').classList.add('hidden');

        // Handle location
        this.handleLocationTap(location, location._element);

        // Show "been here before" toast if applicable
        if (this.recentlyViewed.some(rv => rv.id === location.id)) {
            setTimeout(() => {
                this.showToast('👋 You searched this location before');
            }, 1000);
        }
    }

    // ============================================
    // SEARCH HISTORY
    // ============================================
    loadSearchHistory() {
        try {
            const stored = localStorage.getItem('akrada_search_history');
            this.searchHistory = stored ? JSON.parse(stored) : [];
        } catch {
            this.searchHistory = [];
        }
    }

    addToSearchHistory(query) {
        this.searchHistory = this.searchHistory.filter(s => s.toLowerCase() !== query.toLowerCase());
        this.searchHistory.unshift(query);
        if (this.searchHistory.length > 5) {
            this.searchHistory = this.searchHistory.slice(0, 5);
        }
        localStorage.setItem('akrada_search_history', JSON.stringify(this.searchHistory));
        this.renderSearchHistory();
    }

    renderSearchHistory() {
        const historySection = document.getElementById('search-history-section');
        const historyList = document.getElementById('search-history-list');
        
        if (!historySection || !historyList) return;
        
        if (this.searchHistory.length === 0) {
            historySection.classList.add('hidden');
            return;
        }
        
        historySection.classList.remove('hidden');
        historyList.innerHTML = '';
        
        this.searchHistory.forEach(query => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <div class="search-result-icon">🕐</div>
                <div class="search-result-info">
                    <div class="search-result-name">${query}</div>
                </div>
            `;
            item.addEventListener('click', () => {
                document.getElementById('map-search-input').value = query;
                this.performSearch(query);
            });
            historyList.appendChild(item);
        });
    }

    // ============================================
    // RECENTLY VIEWED
    // ============================================
    loadRecentlyViewed() {
        try {
            const stored = localStorage.getItem('akrada_recently_viewed');
            this.recentlyViewed = stored ? JSON.parse(stored) : [];
        } catch {
            this.recentlyViewed = [];
        }
    }

    addToRecentlyViewed(location) {
        this.recentlyViewed = this.recentlyViewed.filter(rv => rv.id !== location.id);
        this.recentlyViewed.unshift({
            id: location.id,
            name: location.name,
            category: location.category,
            latitude: location.latitude,
            longitude: location.longitude
        });
        if (this.recentlyViewed.length > 3) {
            this.recentlyViewed = this.recentlyViewed.slice(0, 3);
        }
        localStorage.setItem('akrada_recently_viewed', JSON.stringify(this.recentlyViewed));
        this.renderRecentlyViewed();
    }

    renderRecentlyViewed() {
        const container = document.getElementById('recently-viewed');
        const list = document.getElementById('recently-viewed-list');
        
        if (!container || !list) return;
        
        if (this.recentlyViewed.length === 0) {
            container.classList.add('hidden');
            return;
        }
        
        container.classList.remove('hidden');
        list.innerHTML = '';
        
        this.recentlyViewed.forEach(item => {
            const chip = document.createElement('button');
            chip.className = 'recently-viewed-item';
            chip.textContent = item.name;
            chip.addEventListener('click', () => {
                const location = this.locations.find(loc => loc.id === item.id);
                if (location) {
                    this.handleLocationTap(location, location._element);
                }
            });
            list.appendChild(chip);
        });
    }

    // ============================================
    // ANALYTICS TRACKING
    // ============================================
    async trackLocationView(location) {
        try {
            await this.supabase.from('location_views').insert([{
                location_name: location.name,
                campus: this.currentSchool || 'unknown',
                timestamp: new Date().toISOString()
            }]);
        } catch (err) {
            // Silent — analytics shouldn't break UX
        }
    }

    async trackDirectionRequest(location) {
        try {
            await this.supabase.from('direction_requests').insert([{
                from_location: 'user_current',
                to_location: location.name,
                campus: this.currentSchool || 'unknown',
                timestamp: new Date().toISOString()
            }]);
        } catch (err) {
            // Silent
        }
    }

    async trackSearchQuery(query, resultsCount) {
        try {
            await this.supabase.from('search_queries').insert([{
                query_text: query,
                campus: this.currentSchool || 'unknown',
                results_count: resultsCount,
                timestamp: new Date().toISOString()
            }]);
        } catch (err) {
            // Silent
        }
    }

    async trackAppOpen() {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            const { data } = await this.supabase
                .from('user_streaks')
                .select('*')
                .eq('user_id', this.currentUser?.id)
                .eq('date', today)
                .single();
            
            if (!data && this.currentUser) {
                await this.supabase.from('user_streaks').insert([{
                    user_id: this.currentUser.id,
                    date: today,
                    timestamp: new Date().toISOString()
                }]);
            }
        } catch (err) {
            // Silent
        }
    }

    // ============================================
    // FILTER BY CATEGORY
    // ============================================
    filterMapByCategory(category, element) {
        // Update active filter
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.remove('active');
        });
        if (element) {
            element.classList.add('active');
        }

        if (category === 'all') {
            this.addLocationsToMap();
        } else {
            const filtered = this.locations.filter(loc => 
                loc.category && loc.category.toLowerCase() === category.toLowerCase()
            );
            this.addLocationsToMap(filtered);
        }

        // Hide detail card
        this.hideLocationDetailCard();
    }

    // ============================================
    // SHARE SYSTEM
    // ============================================
    shareAkrada() {
        const shareData = {
            title: 'Akrada — Campus Navigation',
            text: 'I just found my way around campus without stress. This app is a lifesaver. Check it out:',
            url: 'https://akrada.vercel.app'
        };

        if (navigator.share) {
            navigator.share(shareData).catch(() => {
                this.copyShareText();
            });
        } else {
            this.copyShareText();
        }
    }

    copyShareText() {
        const text = 'I just found my way around campus without stress. This app is a lifesaver. Check it out: https://akrada.vercel.app';
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('✅ Share link copied!');
        }).catch(() => {
            alert('Share link: ' + text);
        });
    }

    // ============================================
    // COPY TO CLIPBOARD
    // ============================================
    copyToClipboard(text, buttonElement) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('✅ Copied!');
            if (buttonElement) {
                const originalText = buttonElement.textContent;
                buttonElement.textContent = '✅ Copied!';
                setTimeout(() => {
                    buttonElement.textContent = originalText;
                }, 2000);
            }
        }).catch(() => {
            this.showToast('Failed to copy');
        });
    }

    // ============================================
    // REPORT SYSTEM
    // ============================================
    openReportModal(locationName) {
        const modal = document.getElementById('report-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.getElementById('report-location-name').value = locationName || '';
        }
    }

    closeReportModal() {
        const modal = document.getElementById('report-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    async submitReport(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const locationName = formData.get('locationName') || document.getElementById('report-location-name').value;
        const reportType = formData.get('reportType') || document.getElementById('report-type').value;
        const description = formData.get('description') || document.getElementById('report-description').value;

        // Send to your Telegram channel via the existing integration
        const message = `📍 *Location Report*\n\nLocation: ${locationName}\nIssue: ${reportType}\nDescription: ${description}\nCampus: ${this.currentSchool || 'Unknown'}\nReported by: ${this.currentUser?.email || 'Anonymous'}`;
        
        // Track in Supabase
        try {
            await this.supabase.from('location_reports').insert([{
                location_name: locationName,
                campus: this.currentSchool || 'unknown',
                report_type: reportType,
                description: description,
                timestamp: new Date().toISOString()
            }]);
        } catch (err) {
            // Silent
        }

        // Your existing Telegram integration — keep it
        this.sendToTelegram(message);
        
        this.closeReportModal();
        this.showToast('✅ Report submitted. Thank you!');
        e.target.reset();
    }

    sendToTelegram(message) {
        // Keep your existing Telegram webhook/bot logic here
        // This is a placeholder for your existing implementation
        console.log('Sending to Telegram:', message);
        // Your actual Telegram send logic goes here
    }

    // ============================================
    // BUSINESS CLAIM
    // ============================================
    openClaimModal(locationName) {
        const modal = document.getElementById('claim-modal');
        if (modal) {
            modal.classList.remove('hidden');
            document.getElementById('claim-location-name').value = locationName || '';
        }
    }

    closeClaimModal() {
        const modal = document.getElementById('claim-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    async submitBusinessClaim(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const locationName = formData.get('locationName') || document.getElementById('claim-location-name').value;
        const businessName = formData.get('businessName');
        const ownerName = formData.get('ownerName');
        const phoneNumber = formData.get('phoneNumber');
        const category = formData.get('category');
        const campus = formData.get('campus');

        const message = `🏪 *New Business Claim*\n\nBusiness: ${businessName}\nLocation: ${locationName}\nOwner: ${ownerName}\nPhone: ${phoneNumber}\nCategory: ${category}\nCampus: ${campus}`;
        
        this.sendToTelegram(message);
        
        this.closeClaimModal();
        this.showToast('✅ Claim submitted! We\'ll contact you soon.');
        e.target.reset();
    }

    // ============================================
    // REFERRALS
    // ============================================
    async loadReferralHistory() {
        try {
            const { data, error } = await this.supabase
                .from('referrals')
                .select('*')
                .eq('referrer_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (data) {
                const list = document.getElementById('referral-list');
                if (list) {
                    list.innerHTML = '';
                    
                    if (data.length === 0) {
                        list.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No referrals yet. Share your link to start earning!</p>';
                        return;
                    }
                    
                    data.forEach(referral => {
                        const item = document.createElement('div');
                        item.className = 'search-result';
                        item.innerHTML = `
                            <strong>${referral.referred_email || 'Anonymous'}</strong><br>
                            <small>Status: ${referral.status || 'Pending'}</small><br>
                            <small>Earned: ₦${referral.amount || 0}</small>
                        `;
                        list.appendChild(item);
                    });
                }
            }
        } catch (error) {
            console.error('Error loading referral history:', error);
        }
    }

    copyReferralLink() {
        const referralCode = document.getElementById('referral-code').textContent;
        
        if (referralCode && referralCode !== '-') {
            const link = `${window.location.origin}/ref/${referralCode}`;
            navigator.clipboard.writeText(link).then(() => {
                this.showToast('✅ Referral link copied!');
            });
        }
    }

    // ============================================
    // WITHDRAWALS
    // ============================================
    async loadWithdrawalHistory() {
        try {
            const { data, error } = await this.supabase
                .from('withdrawals')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (data) {
                const list = document.getElementById('withdrawal-list');
                if (list) {
                    list.innerHTML = '';
                    
                    if (data.length === 0) {
                        list.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No withdrawal requests yet.</p>';
                        return;
                    }
                    
                    data.forEach(withdrawal => {
                        const item = document.createElement('div');
                        item.className = 'search-result';
                        item.innerHTML = `
                            <strong>₦${withdrawal.amount}</strong><br>
                            <small>Status: ${withdrawal.status || 'Pending'}</small><br>
                            <small>Date: ${new Date(withdrawal.created_at).toLocaleDateString()}</small>
                        `;
                        list.appendChild(item);
                    });
                }
            }
        } catch (error) {
            console.error('Error loading withdrawal history:', error);
        }
    }

    async handleWithdrawalRequest(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const bankName = formData.get('bankName');
        const accountNumber = formData.get('accountNumber');
        const accountName = formData.get('accountName');
        const amount = parseInt(formData.get('amount'));

        if (amount < 1000) {
            alert('Minimum withdrawal amount is ₦1000');
            return;
        }

        try {
            const { error } = await this.supabase
                .from('withdrawals')
                .insert([{
                    user_id: this.currentUser.id,
                    bank_name: bankName,
                    account_number: accountNumber,
                    account_name: accountName,
                    amount: amount,
                    status: 'pending',
                    created_at: new Date().toISOString()
                }]);

            if (error) throw error;
            
            this.showToast('✅ Withdrawal request submitted!');
            e.target.reset();
            this.loadWithdrawalHistory();
        } catch (error) {
            console.error('Withdrawal error:', error);
            alert('Failed to submit withdrawal request.');
        }
    }

    // ============================================
    // LOGOUT
    // ============================================
    async handleLogout() {
        await this.supabase.auth.signOut();
        this.currentUser = null;
        this.currentSchool = null;
        this.locations = [];
        this.showLoginScreen();
    }

    // ============================================
    // PWA INSTALL
    // ============================================
    initInstallBanner() {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            document.getElementById('install-banner').classList.remove('hidden');
        });

        document.getElementById('install-btn')?.addEventListener('click', () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        this.isInstalled = true;
                    }
                    deferredPrompt = null;
                    document.getElementById('install-banner').classList.add('hidden');
                });
            }
        });

        document.getElementById('dismiss-btn')?.addEventListener('click', () => {
            document.getElementById('install-banner').classList.add('hidden');
        });

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
        }
    }

    // ============================================
    // DARK MODE
    // ============================================
    toggleDarkMode(enabled) {
        if (enabled) {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
        localStorage.setItem('akrada_dark_mode', enabled);
    }

    loadDarkModePreference() {
        const saved = localStorage.getItem('akrada_dark_mode');
        if (saved !== null) {
            document.getElementById('dark-mode-toggle').checked = saved === 'true';
            this.toggleDarkMode(saved === 'true');
        }
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    setupEventListeners() {
        // Auth
        document.getElementById('login-form')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('signup-form')?.addEventListener('submit', (e) => this.handleSignup(e));
        document.getElementById('show-signup')?.addEventListener('click', () => this.showSignupScreen());
        document.getElementById('show-login')?.addEventListener('click', () => this.showLoginScreen());
        document.getElementById('forgot-password')?.addEventListener('click', () => {
            alert('Password reset feature coming soon. Contact support for help.');
        });

        // Navigation
        document.querySelectorAll('.menu-item[data-view]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.getAttribute('data-view');
                this.switchView(view);
            });
        });

        document.getElementById('menu-toggle')?.addEventListener('click', () => {
            document.getElementById('sidebar-menu').classList.toggle('active');
        });

        // Close sidebar when clicking outside
        document.getElementById('sidebar-menu')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                document.getElementById('sidebar-menu').classList.remove('active');
            }
        });

        // Map filters
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const category = e.target.getAttribute('data-category');
                this.filterMapByCategory(category, e.target);
            });
        });

        // Map click to close detail card
        document.getElementById('map')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('map') || 
                e.target.classList.contains('mapboxgl-canvas')) {
                this.hideLocationDetailCard();
            }
        });

        // Search
        document.getElementById('map-search-input')?.addEventListener('input', (e) => {
            this.performSearch(e.target.value);
        });
        
        document.getElementById('map-search-input')?.addEventListener('focus', () => {
            this.renderSearchHistory();
            if (this.searchHistory.length > 0) {
                document.getElementById('map-search-dropdown')?.classList.remove('hidden');
                document.getElementById('search-history-section')?.classList.remove('hidden');
            }
        });

        document.getElementById('clear-search-btn')?.addEventListener('click', () => {
            document.getElementById('map-search-input').value = '';
            document.getElementById('map-search-dropdown').classList.add('hidden');
            document.getElementById('clear-search-btn').classList.add('hidden');
        });

        // Close search on outside click
        document.addEventListener('click', (e) => {
            const searchContainer = document.querySelector('.map-search-container');
            if (searchContainer && !searchContainer.contains(e.target)) {
                document.getElementById('map-search-dropdown')?.classList.add('hidden');
                document.getElementById('clear-search-btn')?.classList.add('hidden');
            }
        });

        // Share
        document.getElementById('header-share-btn')?.addEventListener('click', () => this.shareAkrada());
        document.getElementById('share-menu-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.shareAkrada();
        });

        // Copy buttons (Support page)
        document.querySelectorAll('.copy-detail-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-copy');
                if (text) {
                    this.copyToClipboard(text, btn);
                }
            });
        });

        // Report
        document.getElementById('location-report-link')?.addEventListener('click', (e) => {
            e.preventDefault();
            const locationName = e.target.getAttribute('data-location');
            this.openReportModal(locationName);
        });
        
        document.getElementById('close-report-modal')?.addEventListener('click', () => this.closeReportModal());
        document.getElementById('report-form')?.addEventListener('submit', (e) => this.submitReport(e));

        // Claim business
        document.getElementById('claim-business-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            const locationName = document.getElementById('location-card-name')?.textContent;
            this.openClaimModal(locationName);
        });
        
        document.getElementById('close-claim-modal')?.addEventListener('click', () => this.closeClaimModal());
        document.getElementById('claim-form')?.addEventListener('submit', (e) => this.submitBusinessClaim(e));
        document.getElementById('business-claim-form')?.addEventListener('submit', (e) => this.submitBusinessClaim(e));

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });

        // Referral
        document.getElementById('copy-referral-link')?.addEventListener('click', () => this.copyReferralLink());

        // Upgrade
        document.getElementById('upgrade-btn')?.addEventListener('click', () => {
            window.open('https://paystack.com', '_blank');
        });

        // Withdrawal form
        document.getElementById('withdrawal-form')?.addEventListener('submit', (e) => this.handleWithdrawalRequest(e));

        // Delete account
        document.getElementById('delete-account-btn')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
                alert('Account deletion feature coming soon. Contact support for immediate assistance.');
            }
        });

        // Dark mode
        document.getElementById('dark-mode-toggle')?.addEventListener('change', (e) => {
            this.toggleDarkMode(e.target.checked);
        });

        // Categories grid click
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                const category = card.getAttribute('data-category');
                this.switchView('map');
                setTimeout(() => {
                    const chip = document.querySelector(`.filter-chip[data-category="${category}"]`);
                    if (chip) {
                        this.filterMapByCategory(category, chip);
                    }
                }, 300);
            });
        });

        // Search view input
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const resultsContainer = document.getElementById('search-results');
            if (!resultsContainer) return;
            
            if (!query) {
                resultsContainer.innerHTML = '';
                return;
            }
            
            const results = this.locations.filter(loc => 
                loc.name.toLowerCase().includes(query) ||
                (loc.category && loc.category.toLowerCase().includes(query))
            );
            
            resultsContainer.innerHTML = '';
            results.slice(0, 10).forEach(location => {
                const item = document.createElement('div');
                item.className = 'search-result';
                item.innerHTML = `
                    <strong>${location.name}</strong><br>
                    <small>${location.category || 'General'} · ${location.description || 'Tap for details'}</small>
                `;
                item.addEventListener('click', () => {
                    this.switchView('map');
                    setTimeout(() => {
                        this.handleLocationTap(location, location._element);
                    }, 400);
                });
                resultsContainer.appendChild(item);
            });
        });

        // Load dark mode preference
        this.loadDarkModePreference();

        // Track app open
        this.trackAppOpen();
    }
}

// ============================================
// INITIALIZE APP
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    window.akradaApp = new AkradaApp();
});
