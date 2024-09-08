const App = {
    initBody: '',
    count: 0,
    isRendering: false,
    layouts: new Map(),

    /**
     * Fetch JSON data and return the parsed result.
     * @param {string} url
     * @returns {Promise<any>}
     */
    async fetchJSON(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch ${url}`, { cause: res.status });
        return res.json();
    },

    /**
     * Check if the page segments match the path segments.
     * @param {string[]} pageSegs
     * @param {string[]} pathSegs
     * @returns {Promise<boolean>}
     */
    async pathsMatch(pageSegs, pathSegs) {
        if (pageSegs.length !== pathSegs.length) return false;

        const pathSlugs = await this.fetchJSON(`slugs.json`);
        const slugs = pathSlugs[`${pageSegs.join('/')}`] || {};

        for (let i = 0; i < pathSegs.length; i++) {
            if (slugs[pathSegs[i]] && pageSegs[i] !== pathSegs[i]) {
                return false;
            }
        }

        return true;
    },

    /**
     * Render the page based on the given URL.
     * @param {URL} url
     */
    async renderPage(url) {
        let page;
        let params = [];
        const paths = url.pathname.split('/');
        let slugs = {};
        let bestMatchKey = '';
        let bestMatchLength = -1;

        const [indexPages, layouts] = await Promise.all([
            this.fetchJSON(`indexes.json`),
            this.fetchJSON(`layouts.json`)
        ]);

        for(const layout of layouts) {
            this.layouts.set(layout, await this.loadLayout(layout))
        }

        // If root page
        if (url.pathname === '/' && indexPages.includes('/')) {
            await this.loadPage('index');
            return;
        }

        for (const pageKey of indexPages) {
            const pageSegs = pageKey.split('/');
            const isMatch = await this.pathsMatch(pageSegs, paths.slice(0, pageSegs.length));

            if (isMatch && pageSegs.length > bestMatchLength) {
                bestMatchKey = pageKey;
                bestMatchLength = pageSegs.length;
            }
        }

        if (bestMatchKey) {
            page = bestMatchKey;
            params = paths.slice(bestMatchLength);

            const pathSlugs = await this.fetchJSON(`slugs.json`);
            const slugMap = pathSlugs[bestMatchKey] || {};

            for (const [key, idx] of Object.entries(slugMap)) {
                slugs[key] = paths[idx];
            }

            globalThis.$ctx = { params, slugs };
        }

        if (!page) throw new Error(`Page ${url.pathname} not found`, { cause: 404 });

        await this.loadPage(page);
    },

    /**
     * Load and render a page's HTML and JS.
     * @param {string} page
     */
    async loadPage(page) {

        const [response, module] = await Promise.all([
            fetch(`pages/${page}/index.html`),
            import(`./pages/${page}/index.js`)
        ]);

        App.initBody = await response.text();
        globalThis.exports = module;

        if (!App.isRendering) {
            App.isRendering = true;
            this.renderDOM();
            App.isRendering = false;
        }

        App.count = 0;
        this.indexEvents(document.body.children);
    },

    /**
     * Parse the HTML elements and generate a lambda function for rendering.
     * @param {HTMLCollection} elements
     */
    parseHTML(elements) {

        const parsed = [];

        for (const element of elements) {

            if (element.tagName === 'TEMPLATE') {

                const attribute = element.attributes[0];

                if (!attribute) continue;

                if (attribute.name === ':for') parsed.push(`for(${attribute.value}) {`);
                if (attribute.name === ':if') parsed.push(`if(${attribute.value}) {`);

                if (attribute.name === 'layout') {
                    const layoutHTML = this.layouts.get(attribute.value);
                    const tempLayout = document.createElement('div');
                    tempLayout.innerHTML = layoutHTML;

                    this.replaceSlot(tempLayout, element.innerHTML);
                    parsed.push(...this.parseHTML(tempLayout.children));
                } else {
                    const temp = document.createElement('div');
                    temp.innerHTML = element.innerHTML;
                    parsed.push(...this.parseHTML(temp.children));
                }

                if (attribute.name === ':for' || attribute.name === ':if') parsed.push('}');

            } else parsed.push(`elements += \`${element.outerHTML}\``)
        }

        return parsed;
    },

    /**
     * 
     * @param {string} layout
     * @returns {Promise<string>}
     */
    async loadLayout(layout) {

        try {

            const response = await fetch(`layouts/${layout}.html`)

            return await response.text();
        
        } catch (error) {
            
            console.error(`Failed to load layout: ${layout}`, error);
            
            return '';
        }
    },

    /**
     * 
     * @param {HTMLElement} layoutElement 
     * @param {string} templateContent 
     */
    replaceSlot(layoutElement, templateContent) {

        const slot = layoutElement.querySelector('slot')
        
        if (slot) slot.outerHTML = templateContent; // Replace slot with the template content
    },

    /**
     * Recursively assign events to elements.
     * @param {HTMLCollection} elements
     * @param {string | undefined} focusId
     * @param {number | undefined} cursorPos
     */
    indexEvents(elements, focusId, cursorPos) {

        for (const element of elements) {
            
            element.id = element.id.length === 0 ? ++App.count : element.id;

            for (const attribute of element.attributes) {

                if (attribute.name.startsWith('@')) {
                
                    const eventName = attribute.name.slice(1);

                    element.addEventListener(eventName, (e) => {

                        if (['input', 'change', 'submit'].includes(eventName)) {

                            globalThis[attribute.value](e.target.value);

                            if (!App.isRendering) {
                                App.isRendering = true;
                                App.renderDOM()
                                App.isRendering = false;
                            }

                            App.indexEvents(document.body.children, element.id, e.target.selectionStart);

                        } else {

                            eval(attribute.value);

                            if (!App.isRendering) {
                                App.isRendering = true;
                                App.renderDOM()
                                App.isRendering = false;
                            }

                            App.indexEvents(document.body.children);
                        }
                    });
                }
            }

            App.indexEvents(element.children);
        }

         // Re-focus the element after DOM changes
        if (focusId) {

            const element = document.getElementById(focusId);

            if (element) {

                element.focus();

                // Check if setSelectionRange is available and only use it on input-like elements
                if (cursorPos !== null && 'setSelectionRange' in element) {
                    element.setSelectionRange(cursorPos, cursorPos);
                }
            }
        }
    },

    /**
     * Render the DOM by parsing HTML and invoking a lambda function.
     */
    renderDOM() {

        App.count = 0;

        const renderHTML = () => {

            document.body.innerHTML = App.initBody;

            const parsed = App.parseHTML(document.body.children);
            const lambda = App.getLambda(parsed);
            document.body.innerHTML = lambda();
        };

        const cacheValue = (key) => {

            const storeKey = `${location.pathname}/${key}`

            const storedValue = sessionStorage.getItem(storeKey)

            if(storedValue) {

                try {
                    globalThis[key] = JSON.parse(storedValue)
                } catch {
                    globalThis[key] = storedValue
                }

            } else {

                const value = globalThis.exports[key].get()

                if(globalThis.exports.persist) {

                    if(typeof value === 'object') sessionStorage.setItem(storeKey, JSON.stringify(value))
                    else sessionStorage.setItem(storeKey, value)
                }

                globalThis[key] = value
            }
        }

        for (const key in globalThis.exports) {

            const store = globalThis.exports[key];

            if (store && store.subscribe) {

                store.subscribe(val => {

                    if(store.persist) {

                        const storeKey = `${location.pathname}/${key}`

                        if(typeof val === 'object') sessionStorage.setItem(storeKey, JSON.stringify(val))
                        else sessionStorage.setItem(storeKey, val)
                    }

                    globalThis[key] = val;

                    if (!App.isRendering) {
                        App.isRendering = true;
                        renderHTML();
                        App.isRendering = false;
                    }

                    App.indexEvents(document.body.children);
                });

                cacheValue(key);

            } else globalThis[key] = store;
        }

        renderHTML();
    },

    /**
     * Utility to get the lambda function for rendering HTML.
     * @param {string[]} parsedHTML
     * @returns {Function}
     */
    getLambda(parsedHTML) {
        const script = `
            return function () {
                let elements = '';
                ${parsedHTML.join('\n')}
                return elements;
            }
        `;
        return new Function(script)();
    }
}

/**
 * 
 * @param {any} initialValue 
 * @param {boolean} persist 
 */
globalThis.$state = (initialValue, persist = false) => {

    let value = initialValue;

    /** @type {Set<Function>} */
    const subscribers = new Set();

    // Subscribe function to register a listener
    /**
     * 
     * @param {Function} listener 
     */
    function subscribe(listener) {
        subscribers.add(listener);
        // Return an unsubscribe function
        return () => subscribers.delete(listener);
    }

    function get() {
        return value;
    }

    // Set the store value
    function set(newValue) {
        value = newValue;
        notify();
    }

    // Update the store value using a function
    /**
     * 
     * @param {Function} updater 
     */
    function update(updater) {
        value = updater(value);
        notify();
    }

    // Notify all subscribers of the new value
    function notify() {
        subscribers.forEach((listener) => listener(value));
    }

    return {
        get,
        subscribe,
        set,
        update,
        persist
    }
}

// await App.renderPage(new URL(globalThis.location.href))

export default App