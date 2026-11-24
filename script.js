// Smart Language Translator - Main JavaScript File
class LanguageTranslator {
    constructor() {
        // Hardcoded API key - replace with your actual Google Translate API key
        this.apiKey = 'AIzaSyAEz2f43LgDgr3Ec5Rws7IFf1CgPS-5ahQ';
        // Azure Translator API key
        this.azureApiKey = 'AZURE_API_KEY';
        this.azureRegion = 'centralindia'; // Azure region
        this.targetLanguage = localStorage.getItem('targetLanguage') || 'kn';
        // Save Kannada as default if no language is stored
        if (!localStorage.getItem('targetLanguage')) {
            localStorage.setItem('targetLanguage', 'kn');
        }
        this.translationMode = localStorage.getItem('translationMode') || 'transliteration';
        this.detectedLanguage = null;
        this.languageDetected = false; // Flag to track if language has been detected
        this.detectionConfidence = 0; // Store the confidence level
        this.autoDetectEnabled = localStorage.getItem('autoDetectEnabled') !== 'false';
        this.autoTranslate = localStorage.getItem('autoTranslate') !== 'false';
        
        // Ensure auto-detect is enabled by default for transliteration mode
        if (this.translationMode === 'transliteration' && localStorage.getItem('autoDetectEnabled') === null) {
            this.autoDetectEnabled = true;
            localStorage.setItem('autoDetectEnabled', true);
        }
        this.debounceTime = parseInt(localStorage.getItem('debounceTime')) || 800;
        
        this.translateTimeout = null;
        this.isTranslating = false;
        this.currentTransliteration = null;
        this.suggestionOverlay = null;
        this.pendingDetectedLanguage = null; // Store the detected language waiting for user confirmation
        this.userConfirmedLanguage = false; // Track if user confirmed the detected language
        this.autoReplaceEnabled = false; // Track if auto-replacement is enabled
        this.isAutoReplacing = false; // Flag to prevent input event loops during auto-replacement
        
        this.initializeElements();
        this.bindEvents();
        this.initializeApp();
    }

    initializeElements() {
        // Modals
        this.languageModal = document.getElementById('languageModal');
        this.languageDetectionModal = document.getElementById('languageDetectionModal');
        this.apiKeyModal = document.getElementById('apiKeyModal');
        
        // Language selection
        this.languageOptions = document.querySelectorAll('.language-option');
        this.selectedLanguageSpan = document.getElementById('selectedLanguage');
        
        // Input/Output
        this.inputText = document.getElementById('inputText');
        this.outputText = document.getElementById('outputText');
        this.copyOutputBtn = document.getElementById('copyOutput');
        
        // Status
        this.statusText = document.getElementById('statusText');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        
        // Settings
        this.settingsContent = document.getElementById('settingsContent');
        this.translationModeSelect = document.getElementById('translationMode');
        this.autoTranslateCheckbox = document.getElementById('autoTranslate');
        this.autoDetectCheckbox = document.getElementById('autoDetect');
        
        // Language Detection Modal elements
        this.detectedLanguageIcon = document.getElementById('detectedLanguageIcon');
        this.detectedLanguageName = document.getElementById('detectedLanguageName');
        this.continueWithDetectedBtn = document.getElementById('continueWithDetected');
        this.cancelDetectionBtn = document.getElementById('cancelDetection');
        
        // Reset button
        this.resetButton = document.getElementById('resetButton');
        
        // API Key elements removed - using hardcoded key
    }

    bindEvents() {
        // Language selection
        this.languageOptions.forEach(option => {
            option.addEventListener('click', () => this.selectLanguage(option));
        });
        
        // Input handling
        this.inputText.addEventListener('input', () => this.handleInput());
        this.copyOutputBtn.addEventListener('click', () => this.copyToClipboard(this.outputText.textContent));
        
        // Settings
        this.translationModeSelect.addEventListener('change', (e) => this.updateTranslationMode(e.target.value));
        this.autoTranslateCheckbox.addEventListener('change', (e) => this.updateAutoTranslate(e.target.checked));
        this.autoDetectCheckbox.addEventListener('change', (e) => this.updateAutoDetect(e.target.checked));
        
        // Language Detection Modal events
        this.continueWithDetectedBtn.addEventListener('click', () => this.continueWithDetectedLanguage());
        this.cancelDetectionBtn.addEventListener('click', () => this.cancelLanguageDetection());
        
        // Reset button event
        this.resetButton.addEventListener('click', () => this.resetPage());
        
        // API Key events removed - using hardcoded key
        
        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target === this.languageModal) this.hideLanguageModal();
            if (e.target === this.languageDetectionModal) this.hideLanguageDetectionModal();
        });
    }

    initializeApp() {
        // Initialize with hardcoded API key
        this.initializeWithApiKey();
        
        // Load saved settings
        this.loadSettings();
        
        // Update UI
        this.updateLanguageDisplay();
        this.updateOutputSectionVisibility();
        this.updateStatus('Ready to translate');
        
        // Test Azure API
        console.log('Auto-detect enabled:', this.autoDetectEnabled);
        console.log('Target language:', this.targetLanguage);
        console.log('Azure API key:', this.azureApiKey ? 'Present' : 'Missing');
        console.log('Azure region:', this.azureRegion);
        
        // Make languageTranslator globally accessible for testing
        window.languageTranslator = this;
    }

    initializeWithApiKey() {
        if (this.targetLanguage) {
            this.enableInput();
        } else {
            this.showLanguageModal();
        }
    }

    // API key modal functions removed - using hardcoded key

    showLanguageModal() {
        this.languageModal.classList.add('show');
        this.updateLanguageSelection();
    }

    hideLanguageModal() {
        this.languageModal.classList.remove('show');
    }

    hideLanguageDetectionModal() {
        this.languageDetectionModal.classList.remove('show');
        this.pendingDetectedLanguage = null;
    }

    continueWithDetectedLanguage() {
        if (!this.pendingDetectedLanguage) return;
        
        const { targetLang, confidence } = this.pendingDetectedLanguage;
        
        // Perform the language switch first
        this.performLanguageSwitch(targetLang, confidence);
        
        // Mark that user confirmed the language
        this.userConfirmedLanguage = true;
        
        // Enable auto-replacement for transliterations
        this.autoReplaceEnabled = true;
        
        // If there's a current transliteration suggestion, apply it immediately
        if (this.currentTransliteration) {
            this.inputText.value = this.currentTransliteration + ' ';
            this.currentTransliteration = null;
            this.removeSuggestionOverlay();
            this.updateStatus('Text automatically replaced with transliteration');
        } else {
            // If no current transliteration but there's text in the input, transliterate it now
            const currentText = this.inputText.value.trim();
            if (currentText) {
                this.transliterateExistingText(currentText);
            }
        }
        
        // Hide the modal
        this.hideLanguageDetectionModal();
        
        // Update status
        this.updateStatus(`Language confirmed: ${this.getLanguageInfo(targetLang).name} - Auto-replacement enabled`);
    }

    cancelLanguageDetection() {
        // Hide the modal
        this.hideLanguageDetectionModal();
        
        // Reset the user confirmation flag so Azure API calls continue
        this.userConfirmedLanguage = false;
        
        // Disable auto-replacement
        this.autoReplaceEnabled = false;
        
        // Update status
        this.updateStatus('Language detection cancelled - continuing with Azure API calls');
    }

    selectLanguage(option) {
        // Remove previous selection
        this.languageOptions.forEach(opt => opt.classList.remove('selected'));
        
        // Add selection to clicked option
        option.classList.add('selected');
        
        // Set the target language immediately
        this.targetLanguage = option.dataset.lang;
        const languageName = option.dataset.name;
        
        // Reset language detection when user manually selects language
        this.languageDetected = false;
        this.detectedLanguage = null;
        this.detectionConfidence = 0;
        this.userConfirmedLanguage = false;
        this.autoReplaceEnabled = false;
        this.isAutoReplacing = false;
        
        localStorage.setItem('targetLanguage', this.targetLanguage);
        this.updateLanguageDisplay(languageName);
        this.hideLanguageModal();
        this.enableInput();
        this.updateStatus(`Language set to ${languageName}`);
    }

    updateLanguageSelection() {
        // Remove selected class from all options first
        this.languageOptions.forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add selected class to current language if it exists
        if (this.targetLanguage) {
            const selectedOption = document.querySelector(`[data-lang="${this.targetLanguage}"]`);
            if (selectedOption) {
                selectedOption.classList.add('selected');
            }
        }
    }

    updateLanguageDisplay(languageName) {
        if (languageName) {
            this.selectedLanguageSpan.textContent = languageName;
        } else if (this.targetLanguage === 'auto') {
            this.selectedLanguageSpan.textContent = 'Auto';
        } else if (this.targetLanguage) {
            // Use native script names for display
            const languageNames = {
                'hi': 'हिन्दी',
                'kn': 'ಕನ್ನಡ',
                'en': 'English'
            };
            this.selectedLanguageSpan.textContent = languageNames[this.targetLanguage] || 'Unknown';
        } else {
            this.selectedLanguageSpan.textContent = 'Select a language';
        }
    }

    enableInput() {
        this.inputText.disabled = false;
        this.inputText.placeholder = 'Type in English...';
    }

    handleInput() {
        // Skip if we're in the middle of auto-replacing to prevent loops
        if (this.isAutoReplacing) {
            return;
        }
        
        const text = this.inputText.value;
        
        if (!text.trim()) {
            this.outputText.textContent = 'Select a language to start typing...';
            // Only reset flags if user hasn't confirmed a language
            if (!this.userConfirmedLanguage) {
                this.languageDetected = false;
                this.detectedLanguage = null;
                this.detectionConfidence = 0;
                this.userConfirmedLanguage = false;
                this.autoReplaceEnabled = false;
                this.isAutoReplacing = false;
            }
            return;
        }

        if (this.autoTranslate) {
            // If auto-replacement is enabled (user confirmed language), do word-by-word transliteration
            if (this.autoReplaceEnabled) {
                this.handleWordByWordTransliteration(text);
            } else {
                // Otherwise use debounced translation for language detection
                this.debounceTranslation(text);
            }
        } else {
            this.updateStatus('Type and press Enter to translate');
        }
    }

    handleWordByWordTransliteration(text) {
        // Get the current cursor position
        const cursorPosition = this.inputText.selectionStart;
        
        // Check if the last character typed was a space
        if (cursorPosition > 0 && text[cursorPosition - 1] === ' ') {
            // Find the word that was just completed (before the space)
            const textBeforeSpace = text.substring(0, cursorPosition - 1);
            const words = textBeforeSpace.trim().split(/\s+/);
            const lastWord = words[words.length - 1];
            
            // Only transliterate if:
            // 1. There's a complete word (not empty and at least 2 characters)
            // 2. The word is not already in the target script (contains only English letters)
            const isCompleteWord = lastWord && lastWord.length >= 2;
            const isEnglishWord = isCompleteWord && /^[a-zA-Z]+$/.test(lastWord);
            
            if (isCompleteWord && isEnglishWord) {
                this.transliterateWord(lastWord);
            }
        }
    }

    async transliterateWord(word) {
        if (!word.trim() || this.isTranslating) return;

        try {
            // Set translating flag to prevent multiple simultaneous requests
            this.isTranslating = true;
            
            // Get transliteration for the word
            const transliteratedWord = await this.transliterateWithGoogle(word);
            
            // Replace the word in the input
            this.replaceWordInInput(word, transliteratedWord);
            
        } catch (error) {
            console.error('Word transliteration error:', error);
            // Don't show error to user for individual word failures
        } finally {
            this.isTranslating = false;
        }
    }

    async transliterateExistingText(text) {
        if (!text.trim() || this.isTranslating) return;

        try {
            // Set translating flag to prevent multiple simultaneous requests
            this.isTranslating = true;
            this.showLoading(true);
            this.updateStatus('Transliterating existing text...');
            
            // Get transliteration for the entire text
            const transliteratedText = await this.transliterateWithGoogle(text);
            
            // Replace the entire text in the input
            this.inputText.value = transliteratedText;
            
            // Update status
            this.updateStatus('Existing text replaced with transliteration');
            
        } catch (error) {
            console.error('Existing text transliteration error:', error);
            this.updateStatus('Failed to transliterate existing text', 'error');
        } finally {
            this.isTranslating = false;
            this.showLoading(false);
        }
    }

    replaceWordInInput(originalWord, transliteratedWord) {
        // Set flag to prevent input event loop
        this.isAutoReplacing = true;
        
        const currentText = this.inputText.value;
        const cursorPosition = this.inputText.selectionStart;
        
        // Find the position of the word to replace (the word that was just completed)
        // Look for the word that ends just before the current cursor position
        const textBeforeCursor = currentText.substring(0, cursorPosition);
        const wordStart = textBeforeCursor.lastIndexOf(originalWord);
        
        if (wordStart !== -1) {
            // Replace the word in the text
            const beforeWord = currentText.substring(0, wordStart);
            const afterWord = currentText.substring(wordStart + originalWord.length);
            const newText = beforeWord + transliteratedWord + ' ' + afterWord;
            
            // Update the input value
            this.inputText.value = newText;
            
            // Calculate the new cursor position
            // The cursor should be at the end of the text (where the user was typing)
            const newCursorPosition = newText.length;
            this.inputText.setSelectionRange(newCursorPosition, newCursorPosition);
        }
        
        // Reset flag after a short delay to allow normal input handling
        setTimeout(() => {
            this.isAutoReplacing = false;
        }, 50);
    }

    debounceTranslation(text) {
        clearTimeout(this.translateTimeout);
        this.translateTimeout = setTimeout(() => {
            this.translateText(text);
        }, this.debounceTime);
    }

    async translateText(text) {
        if (!text.trim() || this.isTranslating) return;

        this.isTranslating = true;
        this.showLoading(true);
        
        let statusMessage = 'Processing...';
        if (this.translationMode === 'transliteration') {
            statusMessage = 'Transliterating...';
        } else if (this.translationMode === 'translation') {
            statusMessage = 'Translating...';
        }
        this.updateStatus(statusMessage);

        try {
            // Always attempt language detection if auto-detect is enabled and in transliteration mode
            const shouldDetect = (this.autoDetectEnabled && this.translationMode === 'transliteration');
            
            if (shouldDetect) {
                // Only skip if we have language detection AND user confirmed it
                if (this.languageDetected && this.userConfirmedLanguage) {
                    console.log(`Language detected and user confirmed (${this.detectionConfidence}), skipping Azure API call`);
                } else {
                    console.log(`Attempting language detection... (current confidence: ${this.detectionConfidence}, user confirmed: ${this.userConfirmedLanguage})`);
                    await this.detectLanguage(text);
                }
            } else if (this.translationMode === 'translation') {
                console.log('Auto-detect disabled for translation mode');
            } else {
                console.log('Auto-detect disabled, skipping language detection');
            }
            
            // Check if we have a target language after detection
            if (!this.targetLanguage) {
                this.updateStatus('Please select a target language first');
                return;
            }
            
            let result = text;
            
            if (this.translationMode === 'transliteration') {
                result = await this.transliterateText(text);
                this.showTransliterationHintInInput(text, result);
                // Status message is handled inside showTransliterationHintInInput
            } else if (this.translationMode === 'translation') {
                result = await this.translateWithGoogle(text);
                this.outputText.textContent = result;
                this.updateStatus('Translation completed');
            }
            
        } catch (error) {
            console.error('Translation error:', error);
            this.handleTranslationError(error);
        } finally {
            this.isTranslating = false;
            this.showLoading(false);
        }
    }

    showTransliterationHintInInput(originalText, transliteratedText) {
        // Store the transliterated text for tab replacement
        this.currentTransliteration = transliteratedText;
        
        // If auto-replacement is enabled, replace immediately
        if (this.autoReplaceEnabled) {
            // Set flag to prevent input event loop
            this.isAutoReplacing = true;
            
            this.inputText.value = transliteratedText + ' ';
            this.currentTransliteration = null;
            this.updateStatus('Text automatically replaced with transliteration');
            
            // Reset flag after a short delay to allow normal input handling
            setTimeout(() => {
                this.isAutoReplacing = false;
            }, 100);
            return;
        }
        
        // Create a suggestion overlay
        this.createSuggestionOverlay(transliteratedText);
        
        // Add tab key listener for replacement
        this.inputText.addEventListener('keydown', this.handleTabReplacement.bind(this));
    }

    createSuggestionOverlay(transliteratedText) {
        // Remove existing overlay if any
        this.removeSuggestionOverlay();
        
        // Create overlay element
        const overlay = document.createElement('div');
        overlay.className = 'transliteration-suggestion';
        overlay.textContent = `→ ${transliteratedText} (Press Tab to replace)`;
        
        // Position it right after the cursor
        this.positionSuggestionNearCursor(overlay);
        
        // Store reference for removal
        this.suggestionOverlay = overlay;
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            this.removeSuggestionOverlay();
        }, 5000);
    }

    positionSuggestionNearCursor(overlay) {
        // Get cursor position
        const cursorPosition = this.inputText.selectionStart;
        const textBeforeCursor = this.inputText.value.substring(0, cursorPosition);
        
        // Create a temporary span to measure text width
        const tempSpan = document.createElement('span');
        tempSpan.style.position = 'absolute';
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.whiteSpace = 'pre';
        tempSpan.style.font = window.getComputedStyle(this.inputText).font;
        tempSpan.textContent = textBeforeCursor;
        
        document.body.appendChild(tempSpan);
        const textWidth = tempSpan.offsetWidth;
        document.body.removeChild(tempSpan);
        
        // Position the overlay
        const inputRect = this.inputText.getBoundingClientRect();
        const inputContainer = this.inputText.parentElement;
        inputContainer.style.position = 'relative';
        inputContainer.appendChild(overlay);
        
        // Calculate position relative to input
        const paddingLeft = parseInt(window.getComputedStyle(this.inputText).paddingLeft);
        const paddingTop = parseInt(window.getComputedStyle(this.inputText).paddingTop);
        
        overlay.style.left = `${paddingLeft + textWidth + 5}px`;
        overlay.style.top = `${paddingTop + 2}px`;
    }

    removeSuggestionOverlay() {
        if (this.suggestionOverlay) {
            this.suggestionOverlay.remove();
            this.suggestionOverlay = null;
        }
    }

    handleTabReplacement(e) {
        if (e.key === 'Tab' && this.currentTransliteration) {
            e.preventDefault();
            this.inputText.value = this.currentTransliteration + ' ';
            this.currentTransliteration = null;
            this.updateStatus('Input replaced with transliteration');
            
            // Remove the overlay and event listener
            this.removeSuggestionOverlay();
            this.inputText.removeEventListener('keydown', this.handleTabReplacement);
        }
    }

    async transliterateText(text) {
        // For transliteration, we always convert from English/Latin script to target language script
        // The detected language helps us choose the target language, but we always transliterate from English
        
        // Use Google Transliteration API for accurate transliteration
        try {
            const result = await this.transliterateWithGoogle(text);
            return result;
        } catch (error) {
            console.error('Transliteration error:', error);
            throw error;
        }
    }

    async transliterateWithGoogle(text) {
        if (!this.apiKey) {
            throw new Error('No API key available for transliteration');
        }

        // For better transliteration quality, we'll use a combination approach
        // First try to get transliteration suggestions from Google
        try {
            // Use Google Translate API which provides good transliteration for many languages
            const url = `https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,
                    target: this.targetLanguage,
                    source: 'en', // Always use English as source for transliteration
                    format: 'text'
                })
            });

            if (!response.ok) {
                throw new Error(`Transliteration failed: ${response.statusText}`);
            }

            const data = await response.json();
            return data.data.translations[0].translatedText;
        } catch (error) {
            // If Google Translate doesn't provide good transliteration, 
            // suggest using Google Input Tools
            throw new Error('For better transliteration quality, please use Google Input Tools at https://www.google.com/inputtools/try/');
        }
    }

    async detectLanguage(text) {
        if (!this.azureApiKey) {
            console.warn('Azure API key not available for language detection');
            return;
        }

        // Only detect if text is substantial enough
        if (text.trim().length < 3) {
            return;
        }

        try {
            console.log('Detecting language for:', text);
            const url = `https://api.cognitive.microsofttranslator.com/detect?api-version=3.0`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': this.azureApiKey,
                    'Ocp-Apim-Subscription-Region': this.azureRegion,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify([{ text: text }])
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Azure API Error:', response.status, response.statusText, errorText);
                throw new Error(`Language detection failed: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Azure detection response:', data);
            
            const detectedLang = data[0].language;
            const confidence = data[0].score;
            
            console.log(`Detected language: ${detectedLang} (confidence: ${confidence})`);
            
            this.detectedLanguage = detectedLang;
            this.detectionConfidence = confidence;
            this.languageDetected = true; // Mark language as detected
            
            // Auto-switch language based on detection
            this.autoSwitchLanguage(detectedLang, confidence);
            
        } catch (error) {
            console.error('Language detection error:', error);
            // Don't throw error, just log it and continue
        }
    }

    autoSwitchLanguage(detectedLang, confidence) {
        console.log(`Auto-switch check: detected=${detectedLang}, confidence=${confidence}, current=${this.targetLanguage}`);
        
        const languageMap = {
            'hi': 'hi',           // Hindi
            'kn': 'kn',           // Kannada
            'kn-Latn': 'kn',      // Kannada in Latin script
            'hi-Latn': 'hi',      // Hindi in Latin script
            'en': 'en'            // English
        };

        const targetLang = languageMap[detectedLang];
        
        if (!targetLang) {
            console.log('Detected language not in supported languages:', detectedLang);
            return;
        }
        
        // For Hindi and Kannada, show confirmation immediately regardless of confidence
        if (targetLang === 'hi' || targetLang === 'kn') {
            console.log(`Hindi/Kannada detected with ${Math.round(confidence * 100)}% confidence, showing confirmation dialog immediately`);
            this.showLanguageDetectionModal(detectedLang, targetLang, confidence);
            return;
        }
        
        // For other languages, only switch if confidence is high enough (> 0.8)
        if (confidence < 0.8) {
            console.log('Confidence too low, not switching');
            return;
        }
        
        // Show confirmation dialog for other languages with high confidence
        console.log(`Language match detected with ${Math.round(confidence * 100)}% confidence, showing confirmation dialog`);
        this.showLanguageDetectionModal(detectedLang, targetLang, confidence);
    }

    showLanguageDetectionModal(detectedLang, targetLang, confidence) {
        // Store the pending detected language
        this.pendingDetectedLanguage = { detectedLang, targetLang, confidence };
        
        // Get language display information
        const languageInfo = this.getLanguageInfo(targetLang);
        
        // Update modal content
        this.detectedLanguageIcon.src = languageInfo.icon;
        this.detectedLanguageName.textContent = languageInfo.name;
        
        // Update confidence display
        const confidenceElement = document.querySelector('.confidence-value');
        if (confidenceElement) {
            confidenceElement.textContent = `${Math.round(confidence * 100)}%`;
        }
        
        // Show the modal
        this.languageDetectionModal.classList.add('show');
        
        // Update status
        this.updateStatus(`Language detected with ${Math.round(confidence * 100)}% confidence: ${languageInfo.name}`);
    }

    getLanguageInfo(langCode) {
        const languageMap = {
            'hi': { name: 'हिन्दी', icon: 'assets/hindi_icon.png' },
            'kn': { name: 'ಕನ್ನಡ', icon: 'assets/kannada_icon.png' },
            'en': { name: 'English', icon: 'assets/english_icon.png' }
        };
        return languageMap[langCode] || { name: 'Unknown', icon: 'assets/auto_icon.png' };
    }

    performLanguageSwitch(targetLang, confidence) {
        // Always switch if no language is selected, or if different language detected
        if (!this.targetLanguage || targetLang !== this.targetLanguage) {
            console.log(`Switching from ${this.targetLanguage || 'none'} to ${targetLang}`);
            
            // Reset language detection state when switching languages
            this.languageDetected = false;
            this.detectedLanguage = null;
            this.detectionConfidence = 0;
            this.userConfirmedLanguage = false;
            this.autoReplaceEnabled = false;
            this.isAutoReplacing = false;
            this.currentTransliteration = null;
            this.removeSuggestionOverlay();
            
            // Update target language
            this.targetLanguage = targetLang;
            localStorage.setItem('targetLanguage', this.targetLanguage);
            
            // Update language display
            const languageNames = {
                'hi': 'हिन्दी',
                'kn': 'ಕನ್ನಡ',
                'en': 'English'
            };
            
            this.updateLanguageDisplay(languageNames[targetLang]);
            
            // Enable input if it wasn't enabled
            this.enableInput();
            
            // Update status to show language switch
            this.updateStatus(`Language auto-switched to ${languageNames[targetLang]} (${Math.round(confidence * 100)}% confidence)`);
        } else {
            console.log('Language already matches, no switch needed');
        }
    }


    async translateWithGoogle(text) {
        if (!this.apiKey) {
            throw new Error('No API key available');
        }

        const url = `https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: text,
                target: this.targetLanguage,
                source: this.detectedLanguage || 'en' // Use detected language or default to English
            })
        });

        if (!response.ok) {
            throw new Error(`Translation failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data.translations[0].translatedText;
    }

    handleTranslationError(error) {
        console.error('Translation error:', error);
        
        if (error.message.includes('API key')) {
            this.updateStatus('Invalid API key. Please check your settings.', 'error');
        } else if (error.message.includes('quota')) {
            this.updateStatus('API quota exceeded. Please try again later.', 'error');
        } else {
            this.updateStatus('Translation failed. Please try again.', 'error');
        }
        
        this.outputText.textContent = 'Translation failed. Please check your API key and try again.';
    }

    clearText() {
        this.inputText.value = '';
        this.outputText.textContent = 'Select a language to start typing...';
        this.updateStatus('Text cleared');
    }

    resetPage() {
        // Clear any ongoing operations
        if (this.translateTimeout) {
            clearTimeout(this.translateTimeout);
        }
        
        // Clear any suggestion overlays
        this.removeSuggestionOverlay();
        
        // Reset all flags and state
        this.isTranslating = false;
        this.isAutoReplacing = false;
        this.autoReplaceEnabled = false;
        this.userConfirmedLanguage = false;
        this.languageDetected = false;
        this.detectedLanguage = null;
        this.detectionConfidence = 0;
        this.currentTransliteration = null;
        this.pendingDetectedLanguage = null;
        
        // Clear localStorage to reset all settings
        localStorage.clear();
        
        // Reload the page
        window.location.reload();
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.updateStatus('Copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy:', error);
            this.updateStatus('Failed to copy to clipboard', 'error');
        }
    }

    // Settings toggle removed - settings are now always visible in bottom right

    loadSettings() {
        this.translationModeSelect.value = this.translationMode;
        this.autoTranslateCheckbox.checked = this.autoTranslate;
        this.autoDetectCheckbox.checked = this.autoDetectEnabled;
        this.updateAutoDetectAvailability();
    }

    updateTranslationMode(mode) {
        this.translationMode = mode;
        localStorage.setItem('translationMode', mode);
        this.updateOutputSectionVisibility();
        
        // Enable auto-detect by default when switching to transliteration mode
        if (mode === 'transliteration') {
            this.autoDetectEnabled = true;
            localStorage.setItem('autoDetectEnabled', true);
            this.updateStatus(`Mode set to: ${mode} - Auto-detect enabled`);
        }
        
        this.updateAutoDetectAvailability();
    }

    updateAutoDetectAvailability() {
        const autoDetectCheckbox = this.autoDetectCheckbox;
        const autoDetectLabel = autoDetectCheckbox.previousElementSibling;
        
        if (this.translationMode === 'transliteration') {
            // Enable auto-detect for transliteration mode
            autoDetectCheckbox.disabled = false;
            autoDetectCheckbox.checked = this.autoDetectEnabled; // Sync checkbox with state
            autoDetectLabel.style.color = '';
            autoDetectLabel.style.opacity = '1';
        } else {
            // Disable auto-detect for translation mode
            autoDetectCheckbox.disabled = true;
            autoDetectCheckbox.checked = false; // Uncheck the checkbox
            this.autoDetectEnabled = false; // Update the internal state
            localStorage.setItem('autoDetectEnabled', false); // Save to localStorage
            autoDetectLabel.style.color = '#999';
            autoDetectLabel.style.opacity = '0.6';
        }
    }

    updateOutputSectionVisibility() {
        const outputSection = document.querySelector('.output-section');
        if (this.translationMode === 'transliteration') {
            outputSection.classList.add('hidden');
            // Hide completely after animation
            setTimeout(() => {
                if (outputSection.classList.contains('hidden')) {
                    outputSection.style.display = 'none';
                }
            }, 300);
        } else {
            outputSection.style.display = 'block';
            // Trigger reflow to ensure the element is visible before animation
            outputSection.offsetHeight;
            outputSection.classList.remove('hidden');
        }
    }

    updateAutoTranslate(enabled) {
        this.autoTranslate = enabled;
        localStorage.setItem('autoTranslate', enabled);
        this.updateStatus(`Auto-translate ${enabled ? 'enabled' : 'disabled'}`);
    }

    updateAutoDetect(enabled) {
        this.autoDetectEnabled = enabled;
        localStorage.setItem('autoDetectEnabled', enabled);
        this.updateStatus(`Auto-detect language ${enabled ? 'enabled' : 'disabled'}`);
    }


    updateStatus(message, type = 'info') {
        this.statusText.textContent = message;
        this.statusText.className = `status-${type}`;
    }

    showLoading(show) {
        this.loadingIndicator.style.display = show ? 'flex' : 'none';
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.languageTranslator = new LanguageTranslator();
});

// Handle Enter key for manual translation
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        const translator = window.languageTranslator;
        if (translator && translator.inputText.value.trim()) {
            translator.translateText(translator.inputText.value);
        }
    }
});
