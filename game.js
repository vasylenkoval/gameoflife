const CELL_DIMS = 32;
const CELLS_MULTIPLIER = 1.5;
const DRAG_TYPE = { delete: 'delete', add: 'add' };

const debounce = (cb, time = 500) => {
    let timer;
    return () => {
        clearTimeout(timer);
        timer = setTimeout(cb, time);
    };
};

class Game {
    state = {
        /**
         * Current dragging type. Only populated when mousedown or touchstart has been registered but hasn't ended.
         * @type {keyof DRAG_TYPE | undefined}
         */
        dragType: undefined,

        /**
         * Interval in ms between generations.
         * @type {number}
         */
        intervalMs: 100,

        /**
         * Id of the browser interval handling the game generations. Undefined when the game is paused.
         * @type {number | undefined}
         */
        intervalId: undefined,

        /**
         * Game's grid element.
         * @type {HTMLDivElement}
         */
        grid: document.getElementById('grid'),
    };

    pause() {
        const btn = document.getElementById('playBtn');
        btn.innerText = 'Start';
        clearInterval(this.state.intervalId);
        this.state.intervalId = undefined;
    }

    play() {
        const btn = document.getElementById('playBtn');
        btn.innerText = 'Pause';
        this.state.intervalId = setInterval(this.render.bind(this), this.state.intervalMs);
    }

    render() {
        const nodesToKill = [];
        const nodesToResurrect = [];
        const seen = new Set();

        const getIsNodeAlive = (node) => {
            return !!(node && node.dataset.alive);
        };

        const getNode = (rowIdx, colIdx) => {
            return document.getElementById(`${rowIdx}-${colIdx}`);
        };

        const check = (node, recurse = false) => {
            if (seen.has(node.id)) {
                return;
            }

            const ids = node.id.split('-');
            let rowIdx = Number(ids[0]);
            let colIdx = Number(ids[1]);

            const neighbors = {
                topLeft: getNode(rowIdx - 1, colIdx - 1),
                top: getNode(rowIdx - 1, colIdx),
                topRight: getNode(rowIdx - 1, colIdx + 1),
                right: getNode(rowIdx, colIdx + 1),
                bottomRight: getNode(rowIdx + 1, colIdx + 1),
                bottom: getNode(rowIdx + 1, colIdx),
                bottomLeft: getNode(rowIdx + 1, colIdx - 1),
                left: getNode(rowIdx, colIdx - 1),
            };

            const neighborsArr = Object.values(neighbors).filter(Boolean);
            if (recurse) {
                neighborsArr.forEach((cell) => check(cell));
            }

            const isAlive = getIsNodeAlive(node);
            const aliveNeighbors = neighborsArr.filter(getIsNodeAlive).length;

            seen.add(node.id);

            if (isAlive) {
                // Alive cell with 2-3 neighbors survives
                if (aliveNeighbors === 2 || aliveNeighbors === 3) {
                    return;
                }

                // All other live cells die in the next generation. Similarly, all other dead cells stay dead.
                nodesToKill.push(node);
                return;
            }

            // Any dead cell with three live neighbors becomes a live cell
            if (aliveNeighbors === 3) {
                nodesToResurrect.push(node);
            }
        };

        document.querySelectorAll('[data-alive]').forEach((node) => check(node, true));

        for (let nodeToKill of nodesToKill) {
            nodeToKill.removeAttribute('data-alive');
        }

        for (let nodeToResurrect of nodesToResurrect) {
            nodeToResurrect.dataset.alive = 'true';
        }
    }

    initPlayBtn() {
        const btn = document.getElementById('playBtn');
        btn.addEventListener('click', () => {
            this.state.intervalId === undefined ? this.play() : this.pause();
        });
    }

    initClearBtn() {
        const btn = document.getElementById('clearBtn');
        btn.onclick = () => {
            this.pause();
            this.state.grid.childNodes.forEach((row) =>
                row.childNodes.forEach((col) => {
                    if (col.dataset.alive) {
                        col.removeAttribute('data-alive');
                    }
                })
            );
        };
    }

    initDragging() {
        const onDrag = (isDragStart) => (event) => {
            if (!isDragStart) {
                this.state.grid.classList.remove('grid--deleteMode');
                this.state.dragType = undefined;
            }

            if (isDragStart && event.target.classList.contains('col')) {
                this.state.dragType =
                    event.target.dataset.alive !== 'true' ? DRAG_TYPE.delete : DRAG_TYPE.add;

                if (this.state.dragType === DRAG_TYPE.delete) {
                    this.state.grid.classList.add('grid--deleteMode');
                }
            }
        };

        const grid = this.state.grid;
        grid.addEventListener('mousedown', onDrag(true));
        grid.addEventListener('mouseup', onDrag(false));
        grid.addEventListener('touchstart', onDrag(true));
        grid.addEventListener('touchend', onDrag(false));
    }

    initGrid({ height = window.innerHeight, width = window.innerWidth } = {}) {
        // Rows
        const currRows = this.state.grid.childNodes.length;
        const reqRows = Math.floor((height / CELL_DIMS) * 1.5);

        if (currRows > reqRows) {
            this.state.grid.replaceChildren(...[...this.state.grid.childNodes].slice(0, reqRows));
        } else {
            for (let i = currRows; i < reqRows; i++) {
                const row = document.createElement('div');
                row.classList.add('row');
                this.state.grid.appendChild(row);
            }
        }

        // Columns
        const rows = this.state.grid.childNodes;
        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
            const row = rows[rowIdx];

            const currCols = row.childNodes.length;
            const reqCols = Math.ceil((width / CELL_DIMS) * CELLS_MULTIPLIER);

            if (currCols > reqCols) {
                row.replaceChildren(...[...row.childNodes].slice(0, reqCols));
                continue;
            }

            for (let colIdx = currCols; colIdx < reqCols; colIdx++) {
                const column = document.createElement('div');

                column.classList.add('col');
                column.id = `${rowIdx}-${colIdx}`;

                column.onmousedown = (event) => {
                    if (event.target.dataset.alive === 'true') {
                        event.target.removeAttribute('data-alive');
                        return;
                    }

                    event.target.dataset.alive = 'true';
                };

                column.onmouseenter = (event) => {
                    if (this.state.dragType === DRAG_TYPE.delete) {
                        event.target.removeAttribute('data-alive');
                    } else if (this.state.dragType === DRAG_TYPE.add) {
                        event.target.dataset.alive = 'true';
                    }
                };

                row.appendChild(column);
            }
        }
    }

    init() {
        this.initDragging();
        this.initGrid();
        this.initPlayBtn();
        this.initClearBtn();

        window.addEventListener(
            'resize',
            debounce(() => {
                console.log('I fired');
                this.initGrid();
            })
        );
    }
}

const game = new Game();
game.init();
