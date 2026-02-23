// Knowledge Graph Visualization
class KnowledgeGraph {
    constructor() {
        this.nodes = [];
        this.edges = [];
        this.filteredNodes = [];
        this.filteredEdges = [];
        this.showLabels = true;
        this.simulation = null;
        this.svg = null;
        this.g = null;
        this.zoom = null;
        this.activeFilters = {
            search: '',
            types: new Set(),
            categories: new Set(),
            tags: new Set()
        };

        this.init();
    }

    async init() {
        try {
            // Load data
            const [nodesData, edgesData] = await Promise.all([
                d3.json('../data/nodes.json'),
                d3.json('../data/edges.json')
            ]);

            this.nodes = nodesData;
            this.edges = edgesData;
            this.filteredNodes = [...this.nodes];
            this.filteredEdges = [...this.edges];

            this.setupSVG();
            this.setupFilters();
            this.updateStats();
            this.createGraph();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    setupSVG() {
        const container = d3.select("#graph");
        const containerRect = container.node().getBoundingClientRect();

        this.svg = container
            .attr("width", containerRect.width)
            .attr("height", containerRect.height);

        // Create zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                this.g.attr("transform", event.transform);
            });

        this.svg.call(this.zoom);

        // Create main group for all graph elements
        this.g = this.svg.append("g");

        // Add arrow markers for directed edges
        this.svg.append("defs").selectAll("marker")
            .data(["arrowhead"])
            .enter().append("marker")
            .attr("id", String)
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 20)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "#666");
    }

    createGraph() {
        const width = +this.svg.attr("width");
        const height = +this.svg.attr("height");

        // Create force simulation
        this.simulation = d3.forceSimulation(this.filteredNodes)
            .force("link", d3.forceLink(this.filteredEdges).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(30));

        // Create links
        const link = this.g.append("g")
            .selectAll("path")
            .data(this.filteredEdges)
            .enter().append("path")
            .attr("class", "link");

        // Create nodes
        const node = this.g.append("g")
            .selectAll("circle")
            .data(this.filteredNodes)
            .enter().append("circle")
            .attr("class", d => `node ${d.type}`)
            .attr("r", 15)
            .call(d3.drag()
                .on("start", (event, d) => this.dragStarted(event, d))
                .on("drag", (event, d) => this.dragged(event, d))
                .on("end", (event, d) => this.dragEnded(event, d)))
            .on("click", (event, d) => this.showNodeDetails(d));

        // Create labels
        const label = this.g.append("g")
            .selectAll("text")
            .data(this.filteredNodes)
            .enter().append("text")
            .attr("class", "node-label")
            .attr("dy", 30)
            .text(d => d.name)
            .style("display", this.showLabels ? "block" : "none");

        // Update positions on simulation tick
        this.simulation.on("tick", () => {
            link.attr("d", d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const dr = Math.sqrt(dx * dx + dy * dy);
                return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
            });

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);

            label
                .attr("x", d => d.x)
                .attr("y", d => d.y);
        });

        // Store references for later use
        this.linkSelection = link;
        this.nodeSelection = node;
        this.labelSelection = label;
    }

    showNodeDetails(node) {
        const details = d3.select("#node-details");

        const html = `
            <div class="details">
                <h3>${node.name}</h3>
                <p><strong>Type:</strong> ${node.type}</p>
                <p><strong>Category:</strong> ${node.category}</p>
                <p><strong>Description:</strong> ${node.description}</p>
                <div>
                    <strong>Tags:</strong><br>
                    ${node.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
        `;

        details.html(html);

        // Highlight connected nodes
        this.highlightConnections(node);
    }

    highlightConnections(selectedNode) {
        // Reset all nodes to normal opacity
        this.nodeSelection.style("opacity", 0.3);
        this.linkSelection.style("opacity", 0.1);

        // Highlight selected node
        this.nodeSelection.filter(d => d.id === selectedNode.id)
            .style("opacity", 1);

        // Find and highlight connected nodes and links
        const connectedNodes = new Set([selectedNode.id]);

        this.edges.forEach(edge => {
            if (edge.source.id === selectedNode.id || edge.target.id === selectedNode.id) {
                connectedNodes.add(edge.source.id);
                connectedNodes.add(edge.target.id);
            }
        });

        this.nodeSelection.filter(d => connectedNodes.has(d.id))
            .style("opacity", 1);

        this.linkSelection.filter(d =>
            d.source.id === selectedNode.id || d.target.id === selectedNode.id
        ).style("opacity", 0.8);
    }

    dragStarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    dragEnded(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    resetZoom() {
        this.svg.transition().duration(750).call(
            this.zoom.transform,
            d3.zoomIdentity
        );

        // Reset node highlighting
        this.nodeSelection.style("opacity", 1);
        this.linkSelection.style("opacity", 0.6);
    }

    toggleLabels() {
        this.showLabels = !this.showLabels;
        this.labelSelection.style("display", this.showLabels ? "block" : "none");
    }

    setupFilters() {
        // Extract unique values for filters
        const types = [...new Set(this.nodes.map(n => n.type))];
        const categories = [...new Set(this.nodes.map(n => n.category))];
        const allTags = this.nodes.flatMap(n => n.tags);
        const tagCounts = {};
        allTags.forEach(tag => tagCounts[tag] = (tagCounts[tag] || 0) + 1);
        const popularTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([tag]) => tag);

        // Create filter chips
        this.createFilterChips('typeFilters', types, 'types');
        this.createFilterChips('categoryFilters', categories, 'categories');
        this.createFilterChips('tagFilters', popularTags, 'tags');
    }

    createFilterChips(containerId, items, filterType) {
        const container = d3.select(`#${containerId}`);

        container.selectAll('.filter-chip')
            .data(items)
            .enter()
            .append('div')
            .attr('class', 'filter-chip')
            .text(d => d)
            .on('click', (event, d) => this.toggleFilter(filterType, d));
    }

    toggleFilter(filterType, value) {
        const filterSet = this.activeFilters[filterType];

        if (filterSet.has(value)) {
            filterSet.delete(value);
        } else {
            filterSet.add(value);
        }

        // Update UI
        d3.selectAll('.filter-chip')
            .classed('active', function() {
                const text = d3.select(this).text();
                return filterSet.has(text);
            });

        this.applyFilters();
    }

    search(query) {
        this.activeFilters.search = query.toLowerCase();
        this.applyFilters();
    }

    applyFilters() {
        // Filter nodes
        this.filteredNodes = this.nodes.filter(node => {
            // Search filter
            if (this.activeFilters.search) {
                const searchText = `${node.name} ${node.description} ${node.tags.join(' ')}`.toLowerCase();
                if (!searchText.includes(this.activeFilters.search)) {
                    return false;
                }
            }

            // Type filter
            if (this.activeFilters.types.size > 0 && !this.activeFilters.types.has(node.type)) {
                return false;
            }

            // Category filter
            if (this.activeFilters.categories.size > 0 && !this.activeFilters.categories.has(node.category)) {
                return false;
            }

            // Tags filter
            if (this.activeFilters.tags.size > 0) {
                const hasMatchingTag = node.tags.some(tag => this.activeFilters.tags.has(tag));
                if (!hasMatchingTag) {
                    return false;
                }
            }

            return true;
        });

        // Filter edges - only show edges between visible nodes
        const visibleNodeIds = new Set(this.filteredNodes.map(n => n.id));
        this.filteredEdges = this.edges.filter(edge =>
            visibleNodeIds.has(edge.source.id || edge.source) &&
            visibleNodeIds.has(edge.target.id || edge.target)
        );

        this.updateStats();
        this.recreateGraph();
    }

    updateStats() {
        const stats = d3.select('#stats');
        const nodeCount = this.filteredNodes.length;
        const edgeCount = this.filteredEdges.length;
        const totalNodes = this.nodes.length;
        const totalEdges = this.edges.length;

        stats.html(`
            <strong>Showing:</strong> ${nodeCount}/${totalNodes} nodes, ${edgeCount}/${totalEdges} connections
        `);
    }

    recreateGraph() {
        // Clear existing graph
        this.g.selectAll('*').remove();

        // Recreate with filtered data
        this.createGraph();
    }

    clearFilters() {
        this.activeFilters.search = '';
        this.activeFilters.types.clear();
        this.activeFilters.categories.clear();
        this.activeFilters.tags.clear();

        // Clear search input
        document.getElementById('searchInput').value = '';

        // Remove active classes from chips
        d3.selectAll('.filter-chip').classed('active', false);

        this.applyFilters();
    }
}

// Global functions for UI controls
function resetZoom() {
    if (window.graph) {
        window.graph.resetZoom();
    }
}

function toggleLabels() {
    if (window.graph) {
        window.graph.toggleLabels();
    }
}

function handleSearch() {
    const query = document.getElementById('searchInput').value;
    if (window.graph) {
        window.graph.search(query);
    }
}

function clearFilters() {
    if (window.graph) {
        window.graph.clearFilters();
    }
}

// Initialize the graph when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.graph = new KnowledgeGraph();
});