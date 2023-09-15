import fetch from 'node-fetch';
import { IAggregatedVisits } from '../../models/tracking.js';
import { isDuckTypeArray } from '@arcticzeroo/typeguard';

const serverUrl = 'http://localhost:4000';
const applicationName = 'msdining';

export const createTrackingApplicationAsync = async () => {
    await fetch(`${serverUrl}/applications/${applicationName}`, {
        method: 'POST'
    });
};

export const sendVisitAsync = async (visitorId: string) => {
    const response = await fetch(`${serverUrl}/applications/${applicationName}/visits/visitor/${visitorId}`, {
        method: 'PUT'
    });

    if (!response.ok && response.status !== 304) {
        throw new Error('Failed to send visit');
    }
};

const padTimeValue = (value: number) => value.toString().padStart(2, '0');

const getDateString = (date: Date) => {
    return `${date.getUTCFullYear()}-${padTimeValue(date.getUTCMonth() + 1)}-${padTimeValue(date.getUTCDate())}T${padTimeValue(date.getUTCHours())}:${padTimeValue(date.getUTCMinutes())}`;
}

export const getVisitsAsync = async (after: Date): Promise<Array<IAggregatedVisits>> => {
    console.log(`${serverUrl}/applications/${applicationName}/visits?after=${getDateString(after)}`);
    const response = await fetch(`${serverUrl}/applications/${applicationName}/visits?after=${getDateString(after)}`);

    if (!response.ok) {
        throw new Error(`Failed to get visits. Status: ${response.status}, text: ${await response.text()}`);
    }

    const json = await response.json();

    if (!isDuckTypeArray<IAggregatedVisits>(json, {
        count: 'number',
        date: 'string'
    })) {
        throw new Error('Invalid response from server');
    }

    return json;
};

export const afterRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
