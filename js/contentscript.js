// Chrome disabled contentscript in webstroe.
// via: http://stackoverflow.com/a/11614440/260793

var $link = null;

function getSelectionRect(evt, selection) {
    var rect = selection.getRangeAt(0).getBoundingClientRect();

    // 如果是在文本框中，这个坐标返回的会为 0，此时应该取鼠标位置
    if (rect.left === 0 && rect.top === 0) {
        rect = { left: evt.clientX, top: evt.clientY, height: 15 };
    }

    var left = rect.left + document.body.scrollLeft;
    var top  = rect.top + document.body.scrollTop;

    var clientHeight = (document.body.clientHeight < document.documentElement.clientHeight) ? document.body.clientHeight : document.documentElement.clientHeight;
    if (clientHeight === 0) {
        clientHeight = document.documentElement.clientHeight;
    }
    if (rect.top >= 150) {
        var bottom = clientHeight - top;
        return { left: left, bottom: bottom };
    } else {
        return { left: left, top: top + rect.height + 5 };
    }
}

function transIt(evt) {
    $('body').removeClass('transit-link-inspect-mode');

    var selection = window.getSelection();
    var text = $.trim(selection.toString());

    if (text) {
        var position = getSelectionRect(evt, selection);

        chrome.runtime.sendMessage({ type: 'selection', text: text, position: position });
        if (options.notifyMode === 'in-place') {
            doNotify(text, position);
        }
    }
}

var capslockEvents = [];
function toggleLinkInspectMode(evt) {
    if (!(options.linkInspect && evt.keyCode == 20)) return;

    capslockEvents.push(evt.keyCode);
    if (capslockEvents.length == 1) {
        var timer = setTimeout(function() {
            capslockEvents = [];
            clearTimeout(timer);
        }, 500);
    } else {
        $('body').toggleClass('transit-link-inspect-mode');
        capslockEvents = [];
    }
}

initOptions(function(options) {
    $(document).on('keyup keydown', toggleLinkInspectMode);
    $(document).on('mouseup', transIt);
    log('action.user.js initialized.')
});

var PAT_ENGLISH = /^[a-z]+(\'|\'s)?$/i;
var tpls = $.extend(tpls, {
    NOTIFY_LIST: ''
        + '<div id="transit-notify-list">'
        + '  <div class="transit-list-inner"></div>'
        + '</div>'
});

function canTranslate(text) {
    return PAT_ENGLISH.test(text);
}

function delayToHide($notify, waitFor) {
    $notify.delay(waitFor * 1000).fadeOut(function() {
        $(this).remove();
        autoFitNotifyList();
    });
}

function registerHoverEvents($notify) {
    $notify.hover(function(event) {
        $notify.clearQueue();
        $notify.stop();

        if ($notify.is('.transit-in-place')) {
            $notify.insertAfter($('.transit-in-place:last'));
            event.stopPropagation();
        }
    }, function() {
        delayToHide($notify, options.notifyTimeout);
    });
}

function notify(text, waitFor, settings) {
    var $notify = $(this);

    if ($notify.is('.transit-notify')) {
        $notify.html(text);
    } else {
        // Store selection in notify element.
        $notify = $(fmt(TPLS.NOTIFY, fmt(TPLS.LOADING, text)));
        $notify.data('text', text);
        $notify.addClass('transit-' + options.notifyMode);

        if (options.notifyMode === 'margin') {
            $notify.prependTo(getNotifyList().find('.transit-list-inner'))
                   .fadeIn(autoFitNotifyList);
        } else {
            $notify.appendTo('body').css({ position: 'absolute' }).css(settings.position).fadeIn();
        }
    }

    if ($.isFunction(waitFor)) {
        waitFor($notify);
    } else {
        registerHoverEvents($notify);
        delayToHide($notify, waitFor);
    }
}
$.fn.notify = notify;

// Find notify element by selection text `data-text`
function notifyExists(text) {
    var exists = false;

    $('.transit-notify').each(function() {
        if ($(this).data('text') === text) {
            exists = true;
            return false;
        }
    });

    return exists;
}

// When notify list is out of screen, set its height to fix window height.
// and enable scroll without showing scrollbar.
function autoFitNotifyList() {
    var listHeight = getNotifyList().find('.transit-list-inner').outerHeight(),
        windowHeight = $(window).height() + 40;
    getNotifyList().toggleClass('transit-list-full', listHeight > windowHeight);
}

function getNotifyList() {
    var $notifyList = $('#transit-notify-list');
    if ($notifyList.size() === 0) {
        log("Generating notification list at:", location.href);
        $notifyList = $(tpls.NOTIFY_LIST).appendTo('body');
    }
    
    return $notifyList;
}

function doNotify(text, position) {
    // 如果页面划词开启，并且选中的文本符合划词的 PATTERN 才进行翻译
    if (!(options.pageInspect && canTranslate(text))) return;

    // 检查这个单词是否在上次查询中已经用过了，如果是的话, 直接结束这个函数
    if (notifyExists(text)) return;

    notify(text, function($notify) {
        log('Translating:', text);
        var message = { type: 'translate', from: 'page', text: text }
        chrome.extension.sendMessage(message, function(response) {
            log(text, 'translated to', response.translation);
            $notify.notify(response.translation, options.notifyTimeout);
        });
    }, { position: position });
}

function selectionHandler(request) {
    log('Selected:', request.text);

    if (options.notifyMode === 'margin') doNotify(request.text, request.position);
}

initOptions(function() {
    if (window == top) {
        $(window).on('resize', autoFitNotifyList);
        registerMessageDispatcher({ selection: selectionHandler });
    }

    log('Initialized notify.user.js')   
});
