import { Router, type IRouter } from "express";
import healthRouter from "./health";
import spotifyRouter from "./spotify";
import radioRouter from "./radio";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/spotify", spotifyRouter);
router.use("/radio", radioRouter);

export default router;
