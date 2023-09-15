import fetch from 'node-fetch';

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