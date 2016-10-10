import debug from 'debug';
import PrettyError from 'pretty-error';

import { rocConfig } from '../shared/universal-config';

import setupForRender from './setup-for-render';
import { initRenderPage, reactRender } from './render';

const pretty = new PrettyError();
const log = debug('roc:server');

export default function routes({ createRoutes, createStore, stats, dist }) {
    if (!createRoutes) {
        throw new Error('createRoutes needs to be defined');
    }

    if (!stats) {
        throw new Error('stats needs to be defined');
    }

    const renderPage = initRenderPage(stats, dist);

    return function* (next) {
        try {
            // If server side rendering is disabled we do everything on the client
            if (!rocConfig.runtime.ssr) {
                yield next;

                // If response already is managed we will not do anything
                if (this.body || this.status !== 404) {
                    return;
                }

                this.status = 200;
                this.body = renderPage();
            } else {
                const { store, history, url } = setupForRender(createStore, this.url);

                // Give Koa middlewares a chance to interact with the reduxStore
                // This can be used to dynamically pass some data to the client.
                this.state.reduxStore = store;
                yield next;

                // If response already is managed we will not do anything
                if (this.body || this.status !== 404) {
                    return;
                }

                const {
                    body,
                    redirect,
                    status = 200
                } = yield reactRender(url, history, store, createRoutes, renderPage, this.state);

                if (redirect) {
                    this.redirect(redirect);
                } else {
                    this.status = status;
                    this.body = body;
                }
            }
        } catch (error) {
            log('Render error', pretty.render(error));
            this.status = 500;
            this.body = renderPage();
        }
    };
}