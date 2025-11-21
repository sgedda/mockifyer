"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHTTPClient = createHTTPClient;
const axios_client_1 = require("./axios-client");
const fetch_client_1 = require("./fetch-client");
function createHTTPClient(config = {}) {
    const { type = 'axios', baseUrl, defaultHeaders, axiosInstance } = config;
    switch (type) {
        case 'fetch':
            return new fetch_client_1.FetchHTTPClient({ baseUrl, defaultHeaders });
        case 'axios':
        default:
            return new axios_client_1.AxiosHTTPClient(axiosInstance);
    }
}
