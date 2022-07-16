
window.addEventListener("load", () => {
    const draggableGridUls = document.body.querySelectorAll("div.draggable-grid");
    const draggableGrids = [];

    for (const ul of draggableGridUls) {
        draggableGrids.push(new DraggableGrid(ul));
    }
});

// TODO: Observe changes of content of the ul element and update state of the control

const DG_ORIENTATION_HORIZONTAL = "horizontal";
const DG_ORIENTATION_VERTICAL = "vertical";

class DGSize {
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
}

class DraggableGrid {
    // TODO: Maybe loop, fake side items, configuration (transition, animation, animation length...), clean up code

    get _cellSize() {
        const width = this.cellPercSize.width * this.element.clientWidth;
        const height = this.cellPercSize.height * this.element.clientHeight;

        const cellRatio = this.cellSizeRatio;

        let newWidth = width;
        let newHeight = width / cellRatio.width * cellRatio.height;

        if (height < newHeight) {
            newHeight = height;
            newWidth = height / cellRatio.height * cellRatio.width;
        }

        return new DGSize(newWidth, newHeight);
    }

    get cellSizeRatio() {
        if (!this.element.dataset.cellSizeRatio)
            return new DGSize(1, 1);

        const ratioStr = this.element.dataset.cellSizeRatio.replace(" ", "").split("/");
        return new DGSize(parseFloat(ratioStr[0]), parseFloat(ratioStr[1]));
    }

    get cellPercSize() {
        if (!this.element.dataset.maxCellSize)
            return new DGSize(0.5, 0.5);

        const maxCellSize = this.element.dataset.maxCellSize.split(" ").filter(v => v !== "");
        return new DGSize(parseFloat(maxCellSize[0]), parseFloat(maxCellSize[1]));
    }

    get span() {
        if (!this.element.dataset.span)
            return 1;
        return Math.max(parseInt(this.element.dataset.span) || 1, 1);
    }

    get otherSpan() {
        return Math.ceil(this.listItems.length / this.span);
    }

    get orientation() {
        if (!this.element.dataset.orientation)
            return DG_ORIENTATION_HORIZONTAL;
        return this.element.dataset.orientation;
    }

    get isHorizontalOrientation() {
        return this.orientation === DG_ORIENTATION_HORIZONTAL;
    }

    get isVerticalOrientation() {
        return this.orientation === DG_ORIENTATION_VERTICAL;
    }


    constructor(element) {
        this.element = element;
        this.list = element.querySelector(":scope > ul");
        this.listItems = []
        this.currentCenterItem = null;
        this.isDragging = false;
        this.startDraggingClientX = 0;
        this.startDraggingClientY = 0;
        this.startDraggingListX = 0;
        this.startDraggingListY = 0;
        this.lastDraggingListX = 0;
        this.lastDraggingListY = 0;
        this.minDraggingListX = 0;
        this.maxDraggingListX = 0;
        this.minDraggingListY = 0;
        this.maxDraggingListY = 0;
        this._scaledItems = [];

        this._updateListItems();
        this._arrangeItems();
        this._updateVisibilityOfItems();
        this._updateItemsTransition();

        this._changeCurrentItem(this.listItems[0]);

        const mutationObserverConfig = { childList: true };

        this.resizeObserver = new ResizeObserver(e => this._onElementResized(e[0]));
        this.mutationObserver = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === "childList") {
                    this._onChildListChanged(mutation);
                }
            }
        });

        this.resizeObserver.observe(this.element);
        this.mutationObserver.observe(this.element, mutationObserverConfig);

        this.element.addEventListener("pointerdown", e => this._onPointerDown(e));
        window.addEventListener("pointermove", e => this._onPointerMove(e));
        window.addEventListener("pointercancel", e => this._onPointerUp(e));
        window.addEventListener("pointerup", e => this._onPointerUp(e));
        //window.addEventListener("pointerleave", e => this._onPointerUp(e));
    }


    _onPointerDown(e) {
        e.preventDefault();

        const currentPosition = this._getListPositionForItem(this.currentCenterItem);
        const cellSize = this._cellSize;

        this.isDragging = true;
        this.startDraggingClientX = e.clientX;
        this.startDraggingClientY = e.clientY;
        this.startDraggingListX = currentPosition.left;
        this.startDraggingListY = currentPosition.top;

        this.minDraggingListX = this.startDraggingListX - cellSize.width;
        this.maxDraggingListX = this.startDraggingListX + cellSize.width;
        this.minDraggingListY = this.startDraggingListY - cellSize.height;
        this.maxDraggingListY = this.startDraggingListY + cellSize.height;

        this._updateVisibilityOfItems(2);

        return false;
    }

    _onPointerUp(e) {
        if (this.isDragging) {
            e.preventDefault();
            const cellSize = this._cellSize;
            const newItem = this._getItemForListPosition(this.lastDraggingListX - (cellSize.width / 2), this.lastDraggingListY - (cellSize.height / 2));
            this._changeCurrentItem(newItem, true);
        }
        this.isDragging = false;
    }

    _onPointerMove(e) {
        if (this.isDragging) {
            e.preventDefault();
            this.lastDraggingListX = Math.max(Math.min(this.startDraggingListX + (e.clientX - this.startDraggingClientX), this.maxDraggingListX), this.minDraggingListX);
            this.lastDraggingListY = Math.max(Math.min(this.startDraggingListY + (e.clientY - this.startDraggingClientY), this.maxDraggingListY), this.minDraggingListY);
            this._moveListToPosition(this.lastDraggingListX, this.lastDraggingListY);

            const currentCenterItemPosition = this._getListPositionForItem(this.currentCenterItem);
            const currentPosition = this._getCurrentListPosition();

            const vectorX = currentPosition.left - currentCenterItemPosition.left;
            const vectorY = currentPosition.top - currentCenterItemPosition.top;

            this._updateScaledItems(this.currentCenterItem, vectorX, vectorY);

            for (const item of this._scaledItems) {
                const itemPosition = this._getListPositionForItem(item);
                const itemVectorX = currentPosition.left - itemPosition.left;
                const itemVectorY = currentPosition.top - itemPosition.top;
                const vectorLength = this._getVectorLength(itemVectorX, itemVectorY);
                const sideVectorLength = this._getToItemSideVectorLength(itemVectorX, itemVectorY);

                this._updateItemTransition(item, this._getTransitionValueFromVectors(vectorLength, sideVectorLength));
            }
        }
    }

    _onChildListChanged(mutation) {
        this._updateListItems();
        this._updateListSize();
        this._arrangeItems();
        this._updateItemsTransition();
    }

    _onElementResized(e) {
        this._updateListSize();
        this._arrangeItems();
        this._moveListToItem(this.currentCenterItem);
        this._updateItemsTransition();
    }

    _arrangeItems() {
        const cellSize = this._cellSize;
        const top = 0;
        const bottom = top + cellSize.height;
        const left = 0;
        const right = left + cellSize.width;

        for (let i = 0; i < this.listItems.length; i++) {
            const listItem = this.listItems[i];

            const row = this._getRowOfIndex(i);
            const column = this._getColumnOfIndex(i);

            this._setElementPosition(listItem, top + (cellSize.height * row), right + (cellSize.width * column), bottom + (cellSize.height * row), left + (cellSize.width * column));
        }
    }

    _changeCurrentItem(newCurrentItem, animated = false) {
        if (animated) {
            const currentPosition = this._getCurrentListPosition();
            const subAnimations = [];

            for (const item of this._scaledItems) {
                const currentVectorScale = this._getTransitionValueFromPositions(currentPosition, this._getListPositionForItem(item));

                if (item !== newCurrentItem) {
                    subAnimations.push(v => {
                        this._updateItemTransition(item, currentVectorScale - (currentVectorScale * v));
                    });
                }
            }

            const currentVectorScale = this._getTransitionValueFromPositions(currentPosition, this._getListPositionForItem(newCurrentItem));

            subAnimations.push(v => {
                this._updateItemTransition(newCurrentItem, currentVectorScale + ((1 - currentVectorScale) * v));
            });

            const scaleAnimation = new DGAnimation(0, 1, v => {
                for (const subAnimation of subAnimations)
                    subAnimation(v);
            });

            this.currentCenterItem = newCurrentItem
            this._animateListToItem(newCurrentItem).then(() => {
            });
            scaleAnimation.startAnimation(125);
        }
        else {
            this._updateItemTransition(this.currentCenterItem, 0);
            this._updateItemTransition(newCurrentItem, 1);
            this.currentCenterItem = newCurrentItem
            this._moveListToItem(newCurrentItem);
        }
    }

    _moveListToItem(listItem) {
        const newPosition = this._getListPositionForItem(listItem);

        this._moveListToPosition(newPosition.left, newPosition.top);
        this._updateVisibilityOfItems();
    }

    _animateListToItem(listItem) {
        const animationLength = 125;

        const targerPosition = this._getListPositionForItem(listItem);
        const currentPosition = this._getCurrentListPosition();

        const vectorX = targerPosition.left - currentPosition.left;
        const vectorY = targerPosition.top - currentPosition.top;

        const animation = new DGAnimation(0, 1, v => {
            this._moveListToPosition(currentPosition.left + (vectorX * v), currentPosition.top + (vectorY * v));
        }, () => {
            this._moveListToItem(listItem);
        });
        animation.startAnimation(animationLength, Easings.easeOutQuad);

        return new Promise(resolve => setTimeout(resolve, animationLength + 30))
    }

    _moveListToPosition(left, top) {
        this.list.style.top = `${top}px`;
        this.list.style.left = `${left}px`;
    }

    _updateListItems() {
        this.listItems = [...this.list.querySelectorAll(":scope > li")];
        if (!this.currentCenterItem || !this.listItems.includes(this.currentCenterItem))
            this.currentCenterItem = this.listItems[0];

        this.listItems.forEach(li => li.setAttribute("draggable", false));
    }

    _updateVisibilityOfItems(numberOfItemsToSide = 1) {
        const cellSize = this._cellSize;

        const verticalCount = Math.floor((Math.floor(this.element.clientHeight / cellSize.height) - 1) / 2);
        const horizontalCount = Math.floor((Math.floor(this.element.clientWidth / cellSize.width) - 1) / 2);

        for (let i = 0; i < this.listItems.length; i++) {
            const listItem = this.listItems[i];
            const row = this._getRowOfIndex(i);
            const column = this._getColumnOfIndex(i);
            const currentItemRow = this._getRowOfItem(this.currentCenterItem);
            const currentItemColumn = this._getColumnOfItem(this.currentCenterItem);

            listItem.style.display = ((row > currentItemRow + numberOfItemsToSide + verticalCount) ||
                (row < currentItemRow - numberOfItemsToSide - verticalCount) ||
                (column > currentItemColumn + numberOfItemsToSide + horizontalCount) ||
                (column < currentItemColumn - numberOfItemsToSide - horizontalCount)) ?
                "none" :
                "block";
        }
    }

    _updateListSize() {
        const cellSize = this._cellSize;
        const width = this.isHorizontalOrientation ? this.otherSpan * cellSize.width + cellSize.width : this.span * cellSize.width + cellSize.width;
        const height = this.isHorizontalOrientation ? this.span * cellSize.height + cellSize.height : this.otherSpan * cellSize.height + cellSize.height;

        this.list.style.width = `${width}px`;
        this.list.style.height = `${height}px`;
    }

    _updateItemTransition(listItem, value) {
        if (!listItem)
            return;

        const minScale = 0.9;

        listItem.style.transform = `scale(${minScale + ((1 - minScale) * value)})`;
        listItem.style.opacity = `${0.5 + ((1 - 0.5) * value)}`;
    }

    _updateItemsTransition() {
        for (const listItem of this.listItems) {
            this._updateItemTransition(listItem, 0);
        }
        this._updateItemTransition(this.currentCenterItem, 1);
    }

    _updateScaledItems(listItem, vectorX, vectorY) {
        this._scaledItems = [];

        const listItemIndex = this.listItems.indexOf(listItem);
        const scaledItemsIndexes = [];

        scaledItemsIndexes.push(listItemIndex);

        if (vectorX > 0) {
            scaledItemsIndexes.push(this._getLeftNeighborIndex(listItemIndex));
        }
        else {
            scaledItemsIndexes.push(this._getRightNeighborIndex(listItemIndex));
        }
        if (vectorY > 0) {
            for (let i = 0; i < 2; i++) {
                scaledItemsIndexes.push(this._getTopNeighborIndex(scaledItemsIndexes[i]));
            }
        }
        else {
            for (let i = 0; i < 2; i++) {
                scaledItemsIndexes.push(this._getBottomNeighborIndex(scaledItemsIndexes[i]));
            }
        }

        for (const index of scaledItemsIndexes) {
            if (index >= 0 && index < this.listItems.length)
                this._scaledItems.push(this.listItems[index]);
        }
    }

    _getItemForListPosition(left, top) {
        const cellSize = this._cellSize;

        top = top - ((this.element.clientHeight - cellSize.height) / 2);
        left = left - ((this.element.clientWidth - cellSize.width) / 2);

        const row = Math.max(Math.min(Math.floor(-top / cellSize.height), this.isHorizontalOrientation ? this.span - 1 : this.otherSpan - 1), 0);
        const column = Math.max(Math.min(Math.floor(-left / cellSize.width), this.isHorizontalOrientation ? this.otherSpan - 1 : this.span - 1), 0);

        const itemOnPosition = this._getItemOnPosition(row, column);

        if (itemOnPosition === null)
            return this.isHorizontalOrientation ? this._getItemOnPosition(row, column - 1) : this._getItemOnPosition(row - 1, column)

        return this._getItemOnPosition(row, column);
    }

    _getCurrentListPosition() {
        const cellSize = this._cellSize;
        return {
            top: parseFloat(this.list.style.top.replace("px")),
            left: parseFloat(this.list.style.left.replace("px"))
        };
    }

    _getListPositionForItem(listItem) {
        const cellSize = this._cellSize;
        const row = this._getRowOfItem(listItem);
        const column = this._getColumnOfItem(listItem);

        return {
            top: -(row * cellSize.height - (this.element.clientHeight - cellSize.height) / 2),
            left: -(column * cellSize.width - (this.element.clientWidth - cellSize.width) / 2)
        };
    }

    _getTopNeighbor(listItem) {
        const itemIndex = this.listItems.indexOf(listItem);
        const neighborIndex = this._getTopNeighborIndex(itemIndex);
        return neighborIndex >= 0 && neighborIndex < this.listItems.length ? this.listItems[neighborIndex] : null;
    }

    _getBottomNeighbor(listItem) {
        const itemIndex = this.listItems.indexOf(listItem);
        const neighborIndex = this._getBottomNeighborIndex(itemIndex);
        return neighborIndex >= 0 && neighborIndex < this.listItems.length ? this.listItems[neighborIndex] : null;
    }

    _getLeftNeighbor(listItem) {
        const itemIndex = this.listItems.indexOf(listItem);
        const neighborIndex = this._getLeftNeighborIndex(itemIndex);
        return neighborIndex >= 0 && neighborIndex < this.listItems.length ? this.listItems[neighborIndex] : null;
    }

    _getRightNeighbor(listItem) {
        const itemIndex = this.listItems.indexOf(listItem);
        const neighborIndex = this._getRightNeighborIndex(itemIndex);
        return neighborIndex >= 0 && neighborIndex < this.listItems.length ? this.listItems[neighborIndex] : null;
    }

    _getTopNeighborIndex(listItemIndex) {
        return this._getIndexOnPosition(this._getColumnOfIndex(listItemIndex), this._getRowOfIndex(listItemIndex) - 1);
    }

    _getBottomNeighborIndex(listItemIndex) {
        return this._getIndexOnPosition(this._getColumnOfIndex(listItemIndex), this._getRowOfIndex(listItemIndex) + 1);
    }

    _getLeftNeighborIndex(listItemIndex) {
        return this._getIndexOnPosition(this._getColumnOfIndex(listItemIndex) - 1, this._getRowOfIndex(listItemIndex));
    }

    _getRightNeighborIndex(listItemIndex) {
        return this._getIndexOnPosition(this._getColumnOfIndex(listItemIndex) + 1, this._getRowOfIndex(listItemIndex));
    }

    _getColumnOfItem(listItem) {
        const itemIndex = this.listItems.indexOf(listItem);

        if (itemIndex === -1)
            return -1;

        return this._getColumnOfIndex(itemIndex);
    }

    _getRowOfItem(listItem) {
        const itemIndex = this.listItems.indexOf(listItem);

        if (itemIndex === -1)
            return -1;

        return this._getRowOfIndex(itemIndex);
    }

    _getColumnOfIndex(index) {
        return this.isHorizontalOrientation ? Math.floor(index / this.span) : index % this.span;
    }

    _getRowOfIndex(index) {
        return this.isHorizontalOrientation ? index % this.span : Math.floor(index / this.span);
    }

    _getItemOnPosition(row, column) {
        let index = this._getIndexOnPosition(column, row);

        if (((!this.isHorizontalOrientation || row < this.span) && (!this.isVerticalOrientation || row < this.otherSpan)) &&
            ((!this.isHorizontalOrientation || column < this.otherSpan) && (!this.isVerticalOrientation || column < this.span)) &&
            row >= 0 &&
            column >= 0 &&
            index < this.listItems.length)
            return this.listItems[index];
        else
            return null;
    }

    _getIndexOnPosition(column, row) {
        let index;

        if (this.isHorizontalOrientation)
            index = (column * this.span) + row;
        else
            index = (row * this.span) + column;

        return index;
    }

    _getTransitionValueFromPositions(currentPosition, targetPosition) {
        const vectorX = currentPosition.left - targetPosition.left;
        const vectorY = currentPosition.top - targetPosition.top;
        const vectorLength = this._getVectorLength(vectorX, vectorY);
        const sideVectorLength = this._getToItemSideVectorLength(vectorX, vectorY);
        return this._getTransitionValueFromVectors(vectorLength, sideVectorLength);
    }

    _getTransitionValueFromVectors(vectorLength, sideVectorLength) {
        return Math.abs(Math.min(vectorLength / sideVectorLength, 1) - 1);
    }

    _getToItemSideVectorLength(vectorX, vectorY) {
        const cellSize = this._cellSize;

        //const height = cellSize.height / 2;
        //const width = cellSize.width / 2;

        const height = cellSize.height * 0.8;
        const width = cellSize.width * 0.8;

        const normalizedVectorY = vectorY / Math.abs(vectorX / width);

        const verticalVectorIntersection = Math.abs(normalizedVectorY) > height;

        let sideVectorX;
        let sideVectorY;

        if (verticalVectorIntersection) {
            const scale = Math.abs(vectorY / height);

            sideVectorX = vectorX / scale;
            sideVectorY = height * (vectorY < 0 ? -1 : 1);
        }
        else {
            const scale = Math.abs(vectorX / width);

            sideVectorX = width * (vectorX < 0 ? -1 : 1);
            sideVectorY = vectorY / scale;
        }

        return this._getVectorLength(sideVectorX, sideVectorY);
    }

    _getVectorLength(x, y) {
        return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    }

    _parsePixelsString(str) {
        return str.substring(0, str.length - 3);
    }

    _setElementPosition(element, top, right, bottom, left) {
        if (element === null)
            return;

        element.style.top = `${top}px`;
        element.style.right = `${this.list.clientWidth - right}px`;
        element.style.bottom = `${this.list.clientHeight - bottom}px`;
        element.style.left = `${left}px`;
    }
}

class DGAnimation {
    constructor(from, to, callback, onDone = undefined) {
        this._from = from;
        this._to = to;
        this._callback = callback;
        this._onDone = onDone;
    }

    startAnimation(length = 250, easing = undefined) {
        const startTime = Date.now();
        this._loop(startTime, length, this._from, this._to, this._callback, this._onDone, easing ? easing : Easings.linear);
    }

    _loop(startTime, length, from, to, callback, onDone, easing) {
        const elapsedTime = Date.now() - startTime;

        if (elapsedTime < length) {
            callback(easing(from, to, elapsedTime, length));
            requestAnimationFrame(() => this._loop(startTime, length, from, to, callback, onDone, easing));
        }
        else {
            callback(to);
            if (onDone)
                onDone();
        }
    }
}

class Easings {
    static linear(from, to, elapsedTime, length) {
        return (to - from) * (elapsedTime / length);
    }

    static easeOutQuad(from, to, elapsedTime, length) {
        const a = elapsedTime /= length;
        return -to * a * (a - 2) + from;
    }
}