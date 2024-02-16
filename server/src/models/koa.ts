import Router from '@koa/router';
import Koa from 'koa';

export type RouteBuilder = (router: Router) => void;

// Just grabbed this from webstorm
export type RouteContext = Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext & Router.RouterParamContext<Koa.DefaultState, Koa.DefaultContext>, unknown>;