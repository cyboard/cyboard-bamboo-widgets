module.exports = function(widgets, templates, styles, injector) {

    templates.push('./templates');
    styles.addWidgetStylesheet('bamboo-queue', './styles/queue.scss');
    styles.addWidgetStylesheet('bamboo-summary', './styles/summary.scss');

    widgets.register('bamboo-queue', injector.invoke(require('./src/queueWidget')));
    widgets.register('bamboo-summary', injector.invoke(require('./src/summaryWidget')));
}
module.exports.$inject = ['widgetFactory', 'templateManager', 'stylesManager', 'injector'];
