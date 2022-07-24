
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

class DraggableGrid {
    // TODO: Maybe loop, fake side items, configuration (transition, animation, animation length, velocity...), clean up code

    get _cellSize() {
        const width = this.cellPercSize.width * this._element.clientWidth;
        const height = this.cellPercSize.height * this._element.clientHeight;

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
        if (!this._element.dataset.cellSizeRatio)
            return new DGSize(1, 1);

        const ratioStr = this._element.dataset.cellSizeRatio.replace(" ", "").split("/");
        return new DGSize(parseFloat(ratioStr[0]), parseFloat(ratioStr[1]));
    }

    get cellPercSize() {
        if (!this._element.dataset.maxCellSize)
            return new DGSize(0.5, 0.5);

        const maxCellSize = this._element.dataset.maxCellSize.split(" ").filter(v => v !== "");
        return new DGSize(parseFloat(maxCellSize[0]), parseFloat(maxCellSize[1]));
    }

    get span() {
        if (!this._element.dataset.span)
            return 1;
        return Math.max(parseInt(this._element.dataset.span) || 1, 1);
    }

    get otherSpan() {
        return Math.ceil(this._listItems.length / this.span);
    }

    get orientation() {
        if (!this._element.dataset.orientation)
            return DG_ORIENTATION_HORIZONTAL;
        return this._element.dataset.orientation;
    }

    get isHorizontalOrientation() {
        return this.orientation === DG_ORIENTATION_HORIZONTAL;
    }

    get isVerticalOrientation() {
        return this.orientation === DG_ORIENTATION_VERTICAL;
    }


    constructor(element) {
        this._element = element;
        this._list = element.querySelector(":scope > ul");
        this._listItems = []
        this._currentCenterItem = null;
        this._isDragging = false;
        this._startSwipingTime = Date.now();
        this._startDraggingClientX = 0;
        this._startDraggingClientY = 0;
        this._startDraggingListX = 0;
        this._startDraggingListY = 0;
        this._lastDraggingListX = 0;
        this._lastDraggingListY = 0;
        this._minDraggingListX = 0;
        this._maxDraggingListX = 0;
        this._minDraggingListY = 0;
        this._maxDraggingListY = 0;
        this._transitionedItems = [];
        this._transitionAnimation = null;
        this._moveListToItemAnimation = null;
        this.configuration = {
            changingItemTransition: this._defaultItemTransition,
            changingItemTransitionLength: 200,
            changingItemTransitionEasing: DGEasings.easeOutQuad,
            minSwipeVelocity: 1500
        };

        this._updateListItems();
        this._arrangeItems();
        this._updateVisibilityOfItems();
        this._updateItemsTransition();

        this._changeCurrentItem(this._listItems[0]);

        const mutationObserverConfig = { childList: true };

        this.resizeObserver = new ResizeObserver(e => this._onElementResized(e[0]));
        this.mutationObserver = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === "childList") {
                    this._onChildListChanged(mutation);
                }
            }
        });

        this.resizeObserver.observe(this._element);
        this.mutationObserver.observe(this._element, mutationObserverConfig);

        this._element.addEventListener("pointerdown", e => this._onPointerDown(e));
        window.addEventListener("pointermove", e => this._onPointerMove(e));
        window.addEventListener("pointercancel", e => this._onPointerUp(e));
        window.addEventListener("pointerup", e => this._onPointerUp(e));
        //window.addEventListener("pointerleave", e => this._onPointerUp(e));
    }


    _onPointerDown(e) {
        e.preventDefault();

        this._startSwipingTime = Date.now();

        const currentPosition = this._getListPositionForItem(this._currentCenterItem);
        const cellSize = this._cellSize;

        this._isDragging = true;
        this._startDraggingClientX = e.clientX;
        this._startDraggingClientY = e.clientY;
        this._startDraggingListX = currentPosition.left;
        this._startDraggingListY = currentPosition.top;
        this._lastDraggingListX = this._startDraggingListX;
        this._lastDraggingListY = this._startDraggingListY;

        this._minDraggingListX = this._startDraggingListX - cellSize.width;
        this._maxDraggingListX = this._startDraggingListX + cellSize.width;
        this._minDraggingListY = this._startDraggingListY - cellSize.height;
        this._maxDraggingListY = this._startDraggingListY + cellSize.height;

        this._updateVisibilityOfItems(2);

        return false;
    }

    _onPointerUp(e) {
        if (this._isDragging) {
            e.preventDefault();
            const cellSize = this._cellSize;
            let newItem = this._getItemForListPosition(this._lastDraggingListX - (cellSize.width / 2), this._lastDraggingListY - (cellSize.height / 2));

            if (newItem === this._currentCenterItem) {
                const vector = this._getVectorFromCurrentCenterItem();
                const minOffset = 2;

                if (!(Math.abs(vector.x) < minOffset && Math.abs(vector.y) < minOffset)) {
                    const scaledVector = this._getScaledVector(vector.x, vector.y, cellSize.width, cellSize.height);
                    const velocity = this._getVectorLength(scaledVector.x, scaledVector.y) / ((Date.now() - this._startSwipingTime) / 1000);

                    if (Math.abs(scaledVector.y) < cellSize.height) {
                        scaledVector.y = 0;
                    }
                    else {
                        scaledVector.x = 0;
                    }

                    if (velocity >= this.configuration.minSwipeVelocity) {
                        newItem = this._getItemForListPosition(this._startDraggingListX + scaledVector.x, this._startDraggingListY + scaledVector.y);
                    }
                }
            }

            this._changeCurrentItem(newItem, true);
        }
        this._isDragging = false;
    }

    _onPointerMove(e) {
        if (this._isDragging) {
            e.preventDefault();
            this._lastDraggingListX = Math.max(Math.min(this._startDraggingListX + (e.clientX - this._startDraggingClientX), this._maxDraggingListX), this._minDraggingListX);
            this._lastDraggingListY = Math.max(Math.min(this._startDraggingListY + (e.clientY - this._startDraggingClientY), this._maxDraggingListY), this._minDraggingListY);
            this._moveListToPosition(this._lastDraggingListX, this._lastDraggingListY);

            const currentPosition = this._getCurrentListPosition();
            const vector = this._getVectorFromCurrentCenterItem();

            this._updateScaledItems(this._currentCenterItem, vector.x, vector.y);

            for (const item of this._transitionedItems) {
                const itemPosition = this._getListPositionForItem(item);
                const itemVectorX = currentPosition.left - itemPosition.left;
                const itemVectorY = currentPosition.top - itemPosition.top;
                const vectorLength = this._getVectorLength(itemVectorX, itemVectorY);
                const sideVectorLength = this._getToItemSideVectorLength(itemVectorX, itemVectorY);

                this.configuration.changingItemTransition(item, this._getTransitionValueFromVectors(vectorLength, sideVectorLength));
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
        this._moveListToItem(this._currentCenterItem);
        this._updateItemsTransition();
    }

    _arrangeItems() {
        const cellSize = this._cellSize;
        const top = 0;
        const bottom = top + cellSize.height;
        const left = 0;
        const right = left + cellSize.width;

        for (let i = 0; i < this._listItems.length; i++) {
            const listItem = this._listItems[i];

            const row = this._getRowOfIndex(i);
            const column = this._getColumnOfIndex(i);

            this._setElementPosition(listItem, top + (cellSize.height * row), right + (cellSize.width * column), bottom + (cellSize.height * row), left + (cellSize.width * column));
        }
    }

    _changeCurrentItem(newCurrentItem, animated = false) {
        if (animated) {
            if (this._transitionAnimation) {
                this._transitionAnimation.stopAnimation();
            }

            const currentPosition = this._getCurrentListPosition();
            const subAnimations = [];

            for (const item of this._transitionedItems) {
                const currentVectorScale = this._getTransitionValueFromPositions(currentPosition, this._getListPositionForItem(item));

                if (item !== newCurrentItem) {
                    subAnimations.push(v => {
                        this.configuration.changingItemTransition(item, currentVectorScale - (currentVectorScale * v));
                    });
                }
            }

            const currentVectorScale = this._getTransitionValueFromPositions(currentPosition, this._getListPositionForItem(newCurrentItem));

            subAnimations.push(v => {
                this.configuration.changingItemTransition(newCurrentItem, currentVectorScale + ((1 - currentVectorScale) * v));
            });

            this._transitionAnimation = new DGAnimation(0, 1, v => {
                for (const subAnimation of subAnimations)
                    subAnimation(v);
            });

            this._currentCenterItem = newCurrentItem
            this._animateListToItem(newCurrentItem).then(() => {
            });
            this._transitionAnimation.startAnimation(this.configuration.changingItemTransitionLength);
        }
        else {
            this.configuration.changingItemTransition(this._currentCenterItem, 0);
            this.configuration.changingItemTransition(newCurrentItem, 1);
            this._currentCenterItem = newCurrentItem
            this._moveListToItem(newCurrentItem);
        }
    }

    _moveListToItem(listItem) {
        const newPosition = this._getListPositionForItem(listItem);

        this._moveListToPosition(newPosition.left, newPosition.top);
        this._updateVisibilityOfItems();
    }

    _animateListToItem(listItem) {
        const animationLength = this.configuration.changingItemTransitionLength;

        const targerPosition = this._getListPositionForItem(listItem);
        const currentPosition = this._getCurrentListPosition();

        const vectorX = targerPosition.left - currentPosition.left;
        const vectorY = targerPosition.top - currentPosition.top;

        this._moveListToItemAnimation = new DGAnimation(0, 1, v => {
            this._moveListToPosition(currentPosition.left + (vectorX * v), currentPosition.top + (vectorY * v));
        }, () => {
            this._moveListToItem(listItem);
        });
        this._moveListToItemAnimation.startAnimation(animationLength, this.configuration.changingItemTransitionEasing);

        return new Promise(resolve => setTimeout(resolve, animationLength + 30))
    }

    _moveListToPosition(left, top) {
        this._list.style.top = `${top}px`;
        this._list.style.left = `${left}px`;
    }

    _updateListItems() {
        this._listItems = [...this._list.querySelectorAll(":scope > li")];
        if (!this._currentCenterItem || !this._listItems.includes(this._currentCenterItem))
            this._currentCenterItem = this._listItems[0];

        this._listItems.forEach(li => li.setAttribute("draggable", false));
    }

    _updateVisibilityOfItems(numberOfItemsToSide = 1) {
        const cellSize = this._cellSize;

        const verticalCount = Math.floor((Math.floor(this._element.clientHeight / cellSize.height) - 1) / 2);
        const horizontalCount = Math.floor((Math.floor(this._element.clientWidth / cellSize.width) - 1) / 2);

        for (let i = 0; i < this._listItems.length; i++) {
            const listItem = this._listItems[i];
            const row = this._getRowOfIndex(i);
            const column = this._getColumnOfIndex(i);
            const currentItemRow = this._getRowOfItem(this._currentCenterItem);
            const currentItemColumn = this._getColumnOfItem(this._currentCenterItem);

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

        this._list.style.width = `${width}px`;
        this._list.style.height = `${height}px`;
    }

    _defaultItemTransition(listItem, value) {
        if (!listItem)
            return;

        const minScale = 0.9;

        listItem.style.transform = `scale(${minScale + ((1 - minScale) * value)})`;
        listItem.style.opacity = `${0.5 + ((1 - 0.5) * value)}`;
    }

    _updateItemsTransition() {
        for (const listItem of this._listItems) {
            this.configuration.changingItemTransition(listItem, 0);
        }
        this.configuration.changingItemTransition(this._currentCenterItem, 1);
    }

    _updateScaledItems(listItem, vectorX, vectorY) {
        this._transitionedItems = [];

        const listItemIndex = this._listItems.indexOf(listItem);
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
            if (index >= 0 && index < this._listItems.length)
                this._transitionedItems.push(this._listItems[index]);
        }
    }

    _getItemForListPosition(left, top) {
        const cellSize = this._cellSize;

        top = top - ((this._element.clientHeight - cellSize.height) / 2);
        left = left - ((this._element.clientWidth - cellSize.width) / 2);

        const row = Math.max(Math.min(Math.floor(-top / cellSize.height), this.isHorizontalOrientation ? this.span - 1 : this.otherSpan - 1), 0);
        const column = Math.max(Math.min(Math.floor(-left / cellSize.width), this.isHorizontalOrientation ? this.otherSpan - 1 : this.span - 1), 0);

        const itemOnPosition = this._getItemOnPosition(row, column);

        if (itemOnPosition === null)
            return this.isHorizontalOrientation ? this._getItemOnPosition(row, column - 1) : this._getItemOnPosition(row - 1, column)

        return this._getItemOnPosition(row, column);
    }

    _getCurrentListPosition() {
        return {
            top: parseFloat(this._list.style.top.replace("px")),
            left: parseFloat(this._list.style.left.replace("px"))
        };
    }

    _getListPositionForItem(listItem) {
        const cellSize = this._cellSize;
        const row = this._getRowOfItem(listItem);
        const column = this._getColumnOfItem(listItem);

        return {
            top: -(row * cellSize.height - (this._element.clientHeight - cellSize.height) / 2),
            left: -(column * cellSize.width - (this._element.clientWidth - cellSize.width) / 2)
        };
    }

    _getTopNeighbor(listItem) {
        const itemIndex = this._listItems.indexOf(listItem);
        const neighborIndex = this._getTopNeighborIndex(itemIndex);
        return neighborIndex >= 0 && neighborIndex < this._listItems.length ? this._listItems[neighborIndex] : null;
    }

    _getBottomNeighbor(listItem) {
        const itemIndex = this._listItems.indexOf(listItem);
        const neighborIndex = this._getBottomNeighborIndex(itemIndex);
        return neighborIndex >= 0 && neighborIndex < this._listItems.length ? this._listItems[neighborIndex] : null;
    }

    _getLeftNeighbor(listItem) {
        const itemIndex = this._listItems.indexOf(listItem);
        const neighborIndex = this._getLeftNeighborIndex(itemIndex);
        return neighborIndex >= 0 && neighborIndex < this._listItems.length ? this._listItems[neighborIndex] : null;
    }

    _getRightNeighbor(listItem) {
        const itemIndex = this._listItems.indexOf(listItem);
        const neighborIndex = this._getRightNeighborIndex(itemIndex);
        return neighborIndex >= 0 && neighborIndex < this._listItems.length ? this._listItems[neighborIndex] : null;
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
        const itemIndex = this._listItems.indexOf(listItem);

        if (itemIndex === -1)
            return -1;

        return this._getColumnOfIndex(itemIndex);
    }

    _getRowOfItem(listItem) {
        const itemIndex = this._listItems.indexOf(listItem);

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
            index < this._listItems.length)
            return this._listItems[index];
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

        const width = cellSize.width * 0.8;
        const height = cellSize.height * 0.8;

        const sideVector = this._getScaledVector(vectorX, vectorY, width, height);

        return this._getVectorLength(sideVector.x, sideVector.y);
    }

    _getScaledVector(vectorX, vectorY, maxAbsX, maxAbsY) {
        const normalizedVectorY = vectorY / Math.abs(vectorX / maxAbsX);

        const verticalVectorIntersection = Math.abs(normalizedVectorY) > maxAbsY;

        let scaledVectorX;
        let scaledVectorY;

        if (verticalVectorIntersection) {
            const scale = Math.abs(vectorY / maxAbsY);

            scaledVectorX = vectorX / scale;
            scaledVectorY = maxAbsY * (vectorY < 0 ? -1 : 1);
        }
        else {
            const scale = Math.abs(vectorX / maxAbsX);

            scaledVectorX = maxAbsX * (vectorX < 0 ? -1 : 1);
            scaledVectorY = vectorY / scale;
        }

        return { x: scaledVectorX, y: scaledVectorY };
    }

    _getVectorFromCurrentCenterItem() {
        const currentCenterItemPosition = this._getListPositionForItem(this._currentCenterItem);
        const currentPosition = this._getCurrentListPosition();

        const vectorX = currentPosition.left - currentCenterItemPosition.left;
        const vectorY = currentPosition.top - currentCenterItemPosition.top;

        return { x: vectorX, y: vectorY };
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
        element.style.right = `${this._list.clientWidth - right}px`;
        element.style.bottom = `${this._list.clientHeight - bottom}px`;
        element.style.left = `${left}px`;
    }
}

class DGAnimation {
    constructor(from, to, callback, onDone = undefined) {
        this._from = from;
        this._to = to;
        this._callback = callback;
        this._onDone = onDone;
        this._isPlaying = false;
    }

    startAnimation(length = 250, easing = undefined) {
        const startTime = Date.now();
        this._isPlaying = true;
        this._loop(startTime, length, this._from, this._to, this._callback, this._onDone, easing ? easing : DGEasings.linear);
    }

    stopAnimation() {
        this._isPlaying = false;
    }

    _loop(startTime, length, from, to, callback, onDone, easing) {
        const elapsedTime = Date.now() - startTime;

        if (this._isPlaying && elapsedTime < length) {
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

class DGSize {
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
}

class DGEasings {
    static linear(from, to, elapsedTime, length) {
        return (to - from) * (elapsedTime / length);
    }

    static easeOutQuad(from, to, elapsedTime, length) {
        const a = elapsedTime /= length;
        return -to * a * (a - 2) + from;
    }
}