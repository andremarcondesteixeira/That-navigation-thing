import { Page, expect } from "@playwright/test";
import { EventLogger } from "../createEventLoggerFixture";
import { LoadEventDetail } from "../sharedTypes";
import { readFileContent } from "../util";
import { Continuation } from "./Continuation";

export class ElementAssertions {
    constructor(
        private html: string,
        private assertions: ((page: Page, eventLogger: EventLogger) => Promise<void>)[] = [],
        private selector: string,
        private continuation: Continuation,
    ) { }

    hasSameContentOf(filename: string) {
        this.assertions.push(async (page: Page, eventLogger: EventLogger) => {
            await this.compare_element_inner_html_against_file(page, filename, eventLogger);
        });
        return this.continuation;
    }

    private async compare_element_inner_html_against_file(page: Page, filename: string, eventLogger: EventLogger) {
        await this.wait_until_element_has_received_content(page, filename, eventLogger);
        const locator = page.locator(this.selector);
        const actualInnerHTML = (await locator.innerHTML()).trim().replace(/\r\n/g, '\n');
        const expectedInnerHTML = (await readFileContent(filename)).trim().replace(/\r\n/g, '\n');
        expect(actualInnerHTML).toEqual(expectedInnerHTML);
    }

    private wait_until_element_has_received_content(page: Page, loadedFileName: string, eventLogger: EventLogger): Promise<void> {
        return new Promise<void>(resolve => this
            .get_dataTarget_attribute_value_that_points_to_this_same_element(page)
            .then((targetElementId: string) => {
                eventLogger.subscribe({
                    notify: (eventDetail: LoadEventDetail) => {
                        if (
                            eventDetail.responseStatusCode === 200
                            && eventDetail.targetElementId === targetElementId
                            && eventDetail.url.endsWith(loadedFileName)
                        ) {
                            resolve();
                        }
                    },
                });
            })
        );
    }

    private async get_dataTarget_attribute_value_that_points_to_this_same_element(page: Page): Promise<string> {
        return page.evaluate(args => {
            const [html, selector_maybe_not_equal_to_dataTarget_attribute_value] = args;

            const wrapper = window.document.createElement('div');
            wrapper.insertAdjacentHTML('afterbegin', html);
            const desiredTargetElement = wrapper.querySelector(selector_maybe_not_equal_to_dataTarget_attribute_value);

            const anchors = Array.from(wrapper.querySelectorAll('a[data-target]'));
            const dataTargetAttributeValues = anchors.map(a => a.getAttribute('data-target') as string);

            const dataTargetAttributeValue = dataTargetAttributeValues.filter(dataTargetAttributeValue => {
                const element_pointed_to_by_dataTarget_attribute_value = wrapper.querySelector(dataTargetAttributeValue);
                return element_pointed_to_by_dataTarget_attribute_value === desiredTargetElement;
            })[0];

            return dataTargetAttributeValue;
        }, [this.html, this.selector]);
    }
}
