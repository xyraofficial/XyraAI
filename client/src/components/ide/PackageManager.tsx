import { useState } from "react";
import { Search, Package, Download, Trash2, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface InstalledPackage {
  name: string;
  version: string;
  description?: string;
  isDev?: boolean;
}

interface SearchResult {
  name: string;
  version: string;
  description: string;
  downloads: number;
}

interface PackageManagerProps {
  installedPackages?: InstalledPackage[];
  onInstall?: (packageName: string, isDev: boolean) => Promise<void>;
  onUninstall?: (packageName: string) => Promise<void>;
  onSearch?: (query: string) => Promise<SearchResult[]>;
}

// todo: remove mock functionality - replace with real npm API
const mockInstalledPackages: InstalledPackage[] = [
  { name: "react", version: "18.2.0", description: "A JavaScript library for building user interfaces" },
  { name: "react-dom", version: "18.2.0", description: "React package for working with the DOM" },
  { name: "typescript", version: "5.3.0", description: "TypeScript is a language for application scale JavaScript", isDev: true },
  { name: "vite", version: "5.0.0", description: "Next Generation Frontend Tooling", isDev: true },
  { name: "tailwindcss", version: "3.4.0", description: "A utility-first CSS framework", isDev: true },
  { name: "@tanstack/react-query", version: "5.17.0", description: "Powerful asynchronous state management" },
  { name: "wouter", version: "3.0.0", description: "A minimalist-friendly router for React" },
  { name: "lucide-react", version: "0.303.0", description: "Beautiful & consistent icon toolkit" },
];

const mockSearchResults: SearchResult[] = [
  { name: "axios", version: "1.6.0", description: "Promise based HTTP client for the browser and node.js", downloads: 45000000 },
  { name: "lodash", version: "4.17.21", description: "Lodash modular utilities", downloads: 50000000 },
  { name: "date-fns", version: "3.0.0", description: "Modern JavaScript date utility library", downloads: 20000000 },
  { name: "zod", version: "3.22.0", description: "TypeScript-first schema validation", downloads: 8000000 },
  { name: "framer-motion", version: "10.16.0", description: "Production-ready motion library for React", downloads: 3500000 },
];

export default function PackageManager({
  installedPackages = mockInstalledPackages,
  onInstall,
  onUninstall,
  onSearch,
}: PackageManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isInstalling, setIsInstalling] = useState<string | null>(null);
  const [isUninstalling, setIsUninstalling] = useState<string | null>(null);
  const [packages, setPackages] = useState(installedPackages);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    
    try {
      if (onSearch) {
        const results = await onSearch(searchQuery);
        setSearchResults(results);
      } else {
        // Mock search
        await new Promise(resolve => setTimeout(resolve, 500));
        const filtered = mockSearchResults.filter(p => 
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSearchResults(filtered.length > 0 ? filtered : mockSearchResults);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleInstall = async (packageName: string, isDev: boolean = false) => {
    setIsInstalling(packageName);
    try {
      if (onInstall) {
        await onInstall(packageName, isDev);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const pkg = searchResults.find(p => p.name === packageName);
        if (pkg) {
          setPackages(prev => [...prev, {
            name: pkg.name,
            version: pkg.version,
            description: pkg.description,
            isDev
          }]);
        }
      }
    } finally {
      setIsInstalling(null);
    }
  };

  const handleUninstall = async (packageName: string) => {
    setIsUninstalling(packageName);
    try {
      if (onUninstall) {
        await onUninstall(packageName);
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
        setPackages(prev => prev.filter(p => p.name !== packageName));
      }
    } finally {
      setIsUninstalling(null);
    }
  };

  const formatDownloads = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const dependencies = packages.filter(p => !p.isDev);
  const devDependencies = packages.filter(p => p.isDev);

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Package className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Package Manager</span>
        <Badge variant="secondary" className="text-xs ml-auto">
          npm
        </Badge>
      </div>

      <Tabs defaultValue="installed" className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-2">
          <TabsTrigger value="installed" data-testid="tab-installed">
            Installed ({packages.length})
          </TabsTrigger>
          <TabsTrigger value="search" data-testid="tab-search">
            Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="flex-1 overflow-hidden m-0 p-3">
          <ScrollArea className="h-full">
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Dependencies ({dependencies.length})
                </h3>
                <div className="space-y-2">
                  {dependencies.map((pkg) => (
                    <div
                      key={pkg.name}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover-elevate"
                      data-testid={`package-${pkg.name}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{pkg.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {pkg.version}
                          </Badge>
                        </div>
                        {pkg.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {pkg.description}
                          </p>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => handleUninstall(pkg.name)}
                        disabled={isUninstalling === pkg.name}
                        data-testid={`uninstall-${pkg.name}`}
                      >
                        {isUninstalling === pkg.name ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Dev Dependencies ({devDependencies.length})
                </h3>
                <div className="space-y-2">
                  {devDependencies.map((pkg) => (
                    <div
                      key={pkg.name}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover-elevate"
                      data-testid={`package-${pkg.name}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{pkg.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {pkg.version}
                          </Badge>
                        </div>
                        {pkg.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {pkg.description}
                          </p>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => handleUninstall(pkg.name)}
                        disabled={isUninstalling === pkg.name}
                        data-testid={`uninstall-${pkg.name}`}
                      >
                        {isUninstalling === pkg.name ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="search" className="flex-1 overflow-hidden m-0 p-3">
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Search npm packages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              data-testid="input-search-packages"
            />
            <Button onClick={handleSearch} disabled={isSearching} data-testid="button-search-packages">
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          <ScrollArea className="h-[calc(100%-52px)]">
            <div className="space-y-2">
              {searchResults.map((pkg) => {
                const isInstalled = packages.some(p => p.name === pkg.name);
                return (
                  <Card key={pkg.name} className="p-3" data-testid={`search-result-${pkg.name}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{pkg.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {pkg.version}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDownloads(pkg.downloads)} downloads/week
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {pkg.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => window.open(`https://www.npmjs.com/package/${pkg.name}`, '_blank')}
                          data-testid={`npm-link-${pkg.name}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                        {isInstalled ? (
                          <Badge variant="secondary" className="text-xs">Installed</Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7"
                            onClick={() => handleInstall(pkg.name)}
                            disabled={isInstalling === pkg.name}
                            data-testid={`install-${pkg.name}`}
                          >
                            {isInstalling === pkg.name ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5 mr-1" />
                                Install
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
              {searchResults.length === 0 && !isSearching && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Search for npm packages to install
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
