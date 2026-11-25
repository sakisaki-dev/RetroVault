/** Fired by the header's search button (and anything else) to open the quick search (QuickPlayerSearch.tsx answers it). */
export const QUICK_SEARCH_EVENT = 'retrovault:quick-search';
export const openQuickSearch = () => window.dispatchEvent(new Event(QUICK_SEARCH_EVENT));
