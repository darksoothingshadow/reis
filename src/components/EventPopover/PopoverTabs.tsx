/**
 * PopoverTabs - Horizontal scrollable tabs for folder navigation.
 */

interface PopoverTabsProps {
    tabs: string[];
    activeTab: string;
    onTabChange: (tab: string) => void;
    getTabLabel: (tabKey: string) => string;
}

export function PopoverTabs({ tabs, activeTab, onTabChange, getTabLabel }: PopoverTabsProps) {
    if (tabs.length === 0) return null;

    return (
        <div className="flex-shrink-0 flex bg-slate-50/80 border-b border-slate-200 px-2 overflow-x-auto no-scrollbar gap-1 min-h-[48px] items-center">
            <button
                onClick={() => onTabChange('all')}
                className={`relative flex-shrink-0 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'all'
                    ? 'text-primary'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
            >
                Vše
                {activeTab === 'all' && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full" />
                )}
            </button>
            {tabs.map(tabKey => (
                <button
                    key={tabKey}
                    onClick={() => onTabChange(tabKey)}
                    className={`relative flex-shrink-0 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${activeTab === tabKey
                        ? 'text-primary'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    {getTabLabel(tabKey)}
                    {activeTab === tabKey && (
                        <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full" />
                    )}
                </button>
            ))}
        </div>
    );
}
