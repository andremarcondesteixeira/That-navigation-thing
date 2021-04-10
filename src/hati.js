export default function hati(config) {
    const router = config?.router ?? (url => url);

    addClickListeners(config.root);

    function addClickListeners(root) {
        root.querySelectorAll('a[data-target-id]:not([data-target-id=""])')
            .forEach(a => a.addEventListener('click', handleClick));

        root.querySelectorAll('[data-anchors-target-id]:not([data-anchors-target-id=""])')
            .forEach(node => {
                node.querySelectorAll('a:not([data-target-id])')
                    .forEach(a => {
                        const dataAnchorsTargetId = node.getAttribute('data-anchors-target-id');
                        a.setAttribute('data-target-id', dataAnchorsTargetId);
                        a.addEventListener('click', handleClick);
                    });
            });
    }

    function handleClick(event) {
        history.pushState({}, null, event.target.href);
        dispatchBeforeLoadEvent(event.target);
        tryLoadContent(event);
    }

    function dispatchBeforeLoadEvent(anchor) {
        const event = new CustomEvent('hati:beforeLoad', {
            bubbles: true,
            cancelable: true,
            detail: {
                href: anchor.href,
                matchUrl: (regex, callback) => {
                    if (regex.test(anchor.href))
                        callback();
                }
            }
        });
        anchor.dispatchEvent(event);
    }

    async function tryLoadContent(event) {
        event.preventDefault();
        const targetElement = getTargetElement(event.target);
        !!targetElement
            ? doLoadContent(event.target, targetElement)
            : handleError(event.target);
    }

    function getTargetElement(anchor) {
        const targetElementId = anchor.getAttribute('data-target-id');
        const targetElement = config.root.querySelector(`#${targetElementId}`);
        return targetElement;
    }

    async function doLoadContent(anchor, targetElement) {
        const url = router(anchor.href);
        const response = await fetchContent(url);
        renderContentInTargetElement(targetElement, response.content);
        addClickListeners(targetElement);
        dispatchContentLoadedEvent(targetElement, {
            href: anchor.href,
            responseStatusCode: response.statusCode
        });
    }

    async function fetchContent(href) {
        let response = await fetch(href);
        const content = await response.text();
        return {
            content,
            statusCode: response.status
        };
    }

    function renderContentInTargetElement(targetElement, html) {
        while (targetElement.lastChild)
            targetElement.removeChild(targetElement.lastChild);
        targetElement.insertAdjacentHTML('afterbegin', html);
    }

    function dispatchContentLoadedEvent(targetElement, detail) {
        const event = new CustomEvent('hati:DOMContentLoaded', {
            bubbles: true,
            cancelable: true,
            detail: {
                ...detail,
                matchUrl: (regex, callback) => {
                    if (regex.test(detail.href))
                        callback();
                }
            }
        });
        targetElement.dispatchEvent(event);
    }

    function handleError(anchor) {
        const errorMessage = `No element found with id: ${anchor.getAttribute('data-target-id')}`;
        const event = new CustomEvent('hati:error', {
            bubbles: true,
            cancelable: true,
            detail: {
                href: anchor.href,
                errorMessage,
                matchUrl: (regex, callback) => {
                    if (regex.test(anchor.href))
                        callback();
                }
            }
        });
        console.error(errorMessage);
        anchor.dispatchEvent(event);
    }
}
