import { Request, Response } from 'express';

export const showHome = (req: Request, res: Response) => {
  res.render('home', { name: 'Long' });
};
