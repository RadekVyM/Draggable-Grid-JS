# Draggable Grid

JavaScript control that allows you to arrange items of an unordered list into a grid and to move between them by dragging.

[![Sample GIF](./images/sample.gif)](https://radekvym.github.io/Draggable-Grid-JS/index.html)

See [live demo](https://radekvym.github.io/Draggable-Grid-JS/index.html).

## Usage

Import styles needed for the control to function properly:

``` html
<link rel="stylesheet" href="./draggableGrid.css">
```

Wrap an unordered list in a `div` with `draggable-grid` class:

``` html
<div
    class="draggable-grid"
    data-orientation="horizontal"
    data-span="4"
    data-cell-size-ratio="3/4"
    data-max-cell-size="0.65 0.7">
    <ul>
        ...
    </ul>
</div>
```

Parameters of the control can be set via data attributes:

- `data-orientation` - `horizontal` or `vertical` orientation
- `data-span` - number of rows or columns (depends on orientation)
- `data-cell-size-ratio` - width to height ratio of the cell size
- `data-max-cell-size` - how much screen space a cell can occupy (`width height`, 0-1 values)

Import a JavaScript script:

``` html
<script src="./DraggableGrid.js"></script>
```

Initialize the control when the page is loaded:

``` html
<script>
    window.addEventListener("load", () => {
        const draggableGridDivs = document.body.querySelectorAll("div.draggable-grid");

        // Initialization of the control
        for (const div of draggableGridDivs) {
            DraggableGrid.initDraggableGridFor(div);
        }
    });
</script>
```

> For more advanced usage, see the [sample source code](index.html) or the [library source code](./src/DraggableGrid.js). The control's public API is accessible via methods without an underscore.
