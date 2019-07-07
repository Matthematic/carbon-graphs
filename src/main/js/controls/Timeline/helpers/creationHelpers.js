"use strict";
import d3 from "d3";
import { Shape } from "../../../core";
import { getDefaultSVGProps } from "../../../core/Shape";
import {
    buildAxisLabel,
    getAxisLabelHeight,
    getAxisTickFormat,
    getRotationForAxis,
    getXAxisHeight,
    getYAxisHeight,
    prepareXAxis
} from "../../../helpers/axis";
import constants, { SHAPES } from "../../../helpers/constants";
import {
    legendClickHandler,
    legendHoverHandler,
    loadLegendItem
} from "../../../helpers/legend";
import { getSVGObject } from "../../../helpers/shapeSVG";
import styles from "../../../helpers/styles";
import utils from "../../../helpers/utils";
import {
    attachEventHandlers,
    d3RemoveElement,
    detachEventHandlers,
    getColorForTarget,
    getShapeForTarget
} from "../../Graph/helpers/helpers";
import { transformPoint } from "./translateHelpers";

const DEFAULT_HEIGHT = constants.TIMELINE_HEIGHT;

/**
 * Calculates the height for graph
 * @private
 * @param {object} config - config object derived from input JSON
 * @returns {number} Height for the axes
 */
const determineHeight = (config) =>
    DEFAULT_HEIGHT + config.padding.top - config.padding.bottom;
/**
 * Calculates axes label sizes, specifically:
 *  X Axis Label: Height
 *  @private
 *  @param {Object} config - config object derived from input JSON
 *  @returns {undefined} - returns nothing
 */
const calculateAxesLabelSize = (config) => {
    config.axisLabelHeights = {};
    config.axisLabelHeights.x = 0;
    if (config.showLabel) {
        if (config.axis.x.label) {
            config.axisLabelHeights.x = getAxisLabelHeight(config.axis.x.label);
        }
    }
};
/**
 * Calculates axes sizes, specifically:
 *  X Axis: Height
 *  Padding is provided enough to accommodate around 15 characters.
 *  Beyond which we would need to apply truncation (ellipsis)
 *  @private
 *  @param {Object} config - config object derived from input JSON
 *  @returns {undefined} - returns nothing
 */
const calculateAxesSize = (config) => {
    config.axisSizes = {};
    config.axisSizes.x = getXAxisHeight(config);
};
/**
 * X Axis's starting position within the canvas
 * @private
 * @param {object} config - config object derived from input JSON
 * @returns {number} Position for the axis
 */
const getXAxisXPosition = (config) => config.padding.left;
/**
 * X Axis's position vertically relative to the canvas
 * @private
 * @param {object} config - config object derived from input JSON
 * @returns {number} Position for the axis
 */
const getXAxisYPosition = (config) =>
    (config.padding.top + config.padding.bottom) * 2;

/**
 * X Axis's width that will hold equally spaced ticks
 * @private
 * @param {Object} config - config object derived from input JSON
 * @returns {number} X Axis width
 */
const getXAxisWidth = (config) =>
    config.canvasWidth - config.padding.left - getXAxisYPosition(config);
/**
 * X Axis label's starting position below the graph
 * @private
 * @param {Object} config - config object derived from input JSON
 * @returns {number} Position for the label
 */
const getXAxisLabelXPosition = (config) =>
    getXAxisXPosition(config) + getXAxisWidth(config) / 2;
/**
 * X Axis label's position vertically below the graph
 * @private
 * @param {Object} config - config object derived from input JSON
 * @returns {number} Position for the label
 */
const getXAxisLabelYPosition = (config) =>
    getXAxisYPosition(config) +
    config.axisLabelHeights.x * 2 +
    config.padding.bottom * 4;
/**
 * Prepares X,Y and Y2 Axes according to their scale and available container width and height
 * @private
 * @param {Object} axis - Axis scaled according to input parameters
 * @param {Object} scale - d3 scale taking into account the input parameters
 * @param {Object} config - config object derived from input JSON
 * @returns {Object} - Scaled axes object
 */
const getAxesScale = (axis, scale, config) => {
    axis.x = prepareXAxis(
        scale.x,
        config.axis.x.ticks.values,
        getXAxisWidth(config),
        getAxisTickFormat(
            config.locale,
            config.axis.x.ticks.format,
            config.axis.x.type
        )
    ).tickSize(constants.DEFAULT_TIMELINE_TICK_LENGTH);
    return axis;
};
/**
 * Creates and sets the d3 scale for the Graph. Once the scale is created
 * we can create the axes. To create a d3 scale, we need domain and range.
 * To create an axis we need scale, orientation and tick values, if needed
 *
 * The scale function uses d3.linear.nice which rounds the values in the axes.
 * i.e. [0.20147987687960267, 0.996679553296417] will get translated to [0.2, 1]
 *
 * The scale function uses d3.linear.clamp which "clamps" the scale so that any
 * input provided will clamp between the domain.
 * i.e. Before, If you have domain 0 to 20 (input lower and upper bounds) and range 0 to 100 (Width in px).
 * When input 20 is provided then the scale returns the px positioning as 200, which would put the point outside the graph.
 * Instead we clamp it within the graph as an upper bound using clamp. Now, it will return 100px.
 * @private
 * @param {Object} scale - d3 scale taking into account the input parameters
 * @param {Object} config - config object derived from input JSON
 * @returns {undefined} - returns nothing
 */
const scaleGraph = (scale, config) => {
    scale.x = d3.time
        .scale()
        .domain(config.axis.x.domain)
        .range([0, getXAxisWidth(config)])
        .clamp(true);
    if (config.axis.x.rangeRounding) {
        scale.x.nice();
    }
};
/**
 * Added defs element for the canvas. This currently holds the clip paths for the entire chart.
 * @private
 * @param {Object} config - config object derived from input JSON
 * @param {d3.Selection} canvasSVG - d3 selection node of canvas svg
 * @returns {Object} d3 svg path
 */
const createDefs = (config, canvasSVG) =>
    canvasSVG
        .append("defs")
        .append("clipPath")
        .attr("id", config.clipPathId)
        .append("rect")
        .attr(constants.X_AXIS, getXAxisXPosition(config))
        .attr(constants.Y_AXIS, getXAxisYPosition(config) / 2)
        .attr("width", getXAxisWidth(config))
        .attr("height", getYAxisHeight(config));
/**
 * Create the d3 Axis - X and append into the canvas.
 * @private
 * @param {Object} axis - Axis scaled according to input parameters
 * @param {Object} scale - d3 scale taking into account the input parameters
 * @param {Object} config - config object derived from input JSON
 * @param {d3.selection} canvasSVG - d3 selection node of canvas svg
 * @returns {undefined} - returns nothing
 */
const createAxes = (axis, scale, config, canvasSVG) => {
    getAxesScale(axis, scale, config);
    canvasSVG
        .append("g")
        .classed(styles.axis, true)
        .classed(styles.axisX, true)
        .attr("aria-hidden", false)
        .attr(
            "transform",
            `translate(${getXAxisXPosition(config)}, ${getXAxisYPosition(
                config
            )})`
        )
        .call(axis.x);
};
/**
 * Create the d3 Labels - X and append into the canvas.
 * Only if showLabel is enabled. X Axis is 0 deg rotated
 * @private
 * @todo Label overflow formatting, adding ellipsis?
 * @param {Object} config - config object derived from input JSON
 * @param {d3.selection} canvasSVG - d3 selection node of canvas svg
 * @returns {undefined} - returns nothing
 */
const createLabel = (config, canvasSVG) => {
    if (config.showLabel) {
        if (config.axis.x.label) {
            const labelPath = canvasSVG
                .append("g")
                .classed(styles.axisLabelX, true)
                .attr(
                    "transform",
                    `translate(${getXAxisLabelXPosition(
                        config
                    )},${getXAxisLabelYPosition(
                        config
                    )}) rotate(${getRotationForAxis(constants.X_AXIS)})`
                );
            buildAxisLabel(labelPath, utils.sanitize(config.axis.x.label));
        }
    }
};
/**
 * Creates a container for timeline graph
 * @private
 * @param {Object} config - config object derived from input JSON
 * @param {d3.selection} canvasSVG - d3 selection node of canvas svg
 * @returns {Object} d3 svg path
 */
const createTimelineContent = (config, canvasSVG) =>
    canvasSVG
        .append("g")
        .classed(styles.timelineGraphContent, true)
        .attr("clip-path", `url(#${config.clipPathId})`);
/**
 * Creates a group for each timeline content loaded
 * @private
 * @param {Object} config - config object derived from input JSON
 * @param {d3.selection} canvasSVG - d3 selection node of canvas svg
 * @param {Object} contentConfig - content config object
 * @returns {Object} d3 svg path
 */
const createTimelineContentGroup = (config, canvasSVG, contentConfig) =>
    canvasSVG
        .append("g")
        .classed(styles.timelineContentGroup, true)
        .attr("transform", `translate(${getXAxisXPosition(config)},0)`)
        .attr("aria-labelledby", contentConfig.label.display)
        .attr("aria-describedby", contentConfig.key);
/**
 * Toggles the selection of a dateline indicator, executes on click of a data point.
 * @private
 * @param {Object} target - DOM element of the data point clicked
 * @returns {Array} d3 html element of the selected point
 */
const toggleDataPointSelection = (target) => {
    const selectedPointNode = d3
        .select(target.parentNode)
        .select(`.${styles.dataPointSelection}`);
    selectedPointNode.attr(
        "aria-hidden",
        !(selectedPointNode.attr("aria-hidden") === "true")
    );
    return selectedPointNode;
};
/**
 * Handler for the data point on click. If the content property is present for the data point
 * then the callback is executed other wise it is NOP.
 * If the callback is present, the selected data point is toggled and the element is passed as an argument to the
 * consumer in the callback, to execute once the popup is closed.
 *  Callback arguments:
 *      Post close callback function
 *      value [x and y data point values]
 *      Selected data point target [d3 target]
 *  On close of popup, call -> the provided callback
 * @private
 * @param {Object} value - data point object
 * @param {number} index - data point index for the set
 * @param {Object} target - DOM object of the clicked point
 * @returns {undefined} - returns nothing
 */
const dataPointActionHandler = (value, index, target) => {
    if (utils.isEmpty(value.onClick)) {
        return;
    }
    toggleDataPointSelection(target).call((selectedTarget) =>
        value.onClick(
            () => {
                selectedTarget.attr("aria-hidden", true);
            },
            value.key,
            index,
            value,
            selectedTarget
        )
    );
};
/**
 * Draws the points with options opted in the input JSON by the consumer for each data set.
 *  Render the point with appropriate color, shape, x and y co-ordinates, label etc.
 *  On click content callback function is called.
 * @private
 * @param {Object} scale - d3 scale for Graph
 * @param {Object} config - Graph config object derived from input JSON
 * @param {d3.selection} canvasSVG - d3 html element of the canvas
 * @returns {undefined} - returns nothing
 */
const createPoints = (scale, config, canvasSVG) => {
    const renderDataPointPath = (path, value, index) =>
        path.append(() =>
            new Shape(
                getSVGObject(
                    getShapeForTarget(value),
                    constants.DEFAULT_TIMELINE_SCALE
                )
            ).getShapeElement(
                getDefaultSVGProps({
                    svgClassNames: styles.point,
                    svgStyles: `fill: ${getColorForTarget(value)};`,
                    transformFn: transformPoint(scale, config)(value),
                    onClickFn() {
                        dataPointActionHandler(value, index, this);
                    },
                    a11yAttributes: {
                        "aria-describedby": value.key,
                        "aria-hidden":
                            config.shownTargets.indexOf(value.key) < 0,
                        "aria-disabled": !utils.isFunction(value.onClick)
                    }
                })
            )
        );
    const renderSelectionPath = (path, value, index) =>
        path.append(() =>
            new Shape(
                getSVGObject(
                    SHAPES.CIRCLE,
                    constants.DEFAULT_TIMELINE_PLOT_SELECTION_SCALE
                )
            ).getShapeElement(
                getDefaultSVGProps({
                    svgClassNames: styles.dataPointSelection,
                    transformFn: transformPoint(scale, config)(value),
                    onClickFn() {
                        dataPointActionHandler(value, index, this);
                    },
                    a11yAttributes: {
                        "aria-hidden": true,
                        "aria-describedby": value.key,
                        "aria-disabled": !utils.isFunction(value.onClick)
                    }
                })
            )
        );
    canvasSVG
        .append("g")
        .classed(styles.pointGroup, true)
        .each(function(d, i) {
            const dataPointSVG = d3.select(this);
            renderSelectionPath(dataPointSVG, d, i);
            renderDataPointPath(dataPointSVG, d, i);
        });
};
/**
 * A callback that will be sent to Graph class so that when graph is
 * created the Graph API will execute this callback function and the legend
 * items are loaded.
 * @private
 * @param {Object} config - Graph config object derived from input JSON
 * @param {Object} eventHandlers - Object containing click and hover event handlers for legend item
 * @param {Object} dataTarget - Data points object
 * @param {Object} legendSVG - d3 element that will be need to render the legend
 * items into.
 * @returns {undefined} - returns nothing
 */
const prepareLegendItems = (config, eventHandlers, dataTarget, legendSVG) => {
    if (dataTarget.label && dataTarget.label.display && legendSVG) {
        loadLegendItem(
            legendSVG,
            dataTarget,
            config.shownTargets,
            eventHandlers
        );
    }
};
/**
 * Handler for Request animation frame, executes on resize.
 *  * Order of execution
 *      * Redraws the content
 *      * Shows/hides the regions
 * @private
 * @param {Object} graphContext - Graph instance
 * @param {TimelineContent} control - TimelineContent instance
 * @returns {function()} callback function handler for RAF
 */
const onAnimationHandler = (graphContext, control) => () => {
    control.redraw(graphContext);
};
/**
 * Click handler for legend item. Removes the line from graph when clicked and calls redraw
 * @private
 * @param {Object} graphContext - Graph instance
 * @param {TimelineContent} control - TimelineContent instance
 * @param {Object} config - Graph config object derived from input JSON
 * @param {d3.selection} canvasSVG - d3 selection node of canvas svg
 * @returns {function} - returns callback function that handles click action on legend item
 */
const clickHandler = (graphContext, control, config, canvasSVG) => (
    element,
    item
) => {
    const updateShownTarget = (shownTargets, item) => {
        const index = shownTargets.indexOf(item.key);
        if (index > -1) {
            shownTargets.splice(index, 1);
        } else {
            shownTargets.push(item.key);
        }
    };
    legendClickHandler(element);
    updateShownTarget(config.shownTargets, item);
    canvasSVG
        .selectAll(`.${styles.point}[aria-describedby="${item.key}"]`)
        .attr("aria-hidden", true);
    window.requestAnimationFrame(onAnimationHandler(graphContext, control));
};
/**
 * Hover handler for legend item. Highlights current line and blurs the rest of the targets in Graph
 * if present.
 * @private
 * @param {Array} graphTargets - List of all the items in the Graph
 * @param {d3.selection} canvasSVG - d3 selection node of canvas svg
 * @returns {function} - returns callback function that handles hover action on legend item
 */
const hoverHandler = (graphTargets, canvasSVG) => (item, state) => {
    const additionalHoverHandler = (
        shownTargets,
        canvasSVG,
        currentKey,
        hoverState,
        k
    ) => {
        canvasSVG
            .selectAll(`.${styles.point}[aria-describedby="${k}"]`)
            .classed(styles.blur, state === constants.HOVER_EVENT.MOUSE_ENTER);
    };
    legendHoverHandler(graphTargets, canvasSVG, item.key, state, [
        additionalHoverHandler
    ]);
};
/**
 * CLear the graph data points and lines currently rendered
 * @private
 * @param {d3.selection} canvasSVG - d3 selection node of canvas svg
 * @param {Object} dataTarget - Data points object
 * @returns {Object} - d3 select object
 */
const clear = (canvasSVG, dataTarget) =>
    d3RemoveElement(canvasSVG, `g[aria-describedby="${dataTarget.key}"]`);

export {
    calculateAxesLabelSize,
    getXAxisWidth,
    getXAxisXPosition,
    getXAxisYPosition,
    getXAxisLabelXPosition,
    getXAxisLabelYPosition,
    getAxesScale,
    calculateAxesSize,
    createAxes,
    createDefs,
    createLabel,
    createTimelineContent,
    createTimelineContentGroup,
    createPoints,
    hoverHandler,
    clickHandler,
    prepareLegendItems,
    scaleGraph,
    determineHeight,
    getShapeForTarget,
    getColorForTarget,
    attachEventHandlers,
    detachEventHandlers,
    clear
};
