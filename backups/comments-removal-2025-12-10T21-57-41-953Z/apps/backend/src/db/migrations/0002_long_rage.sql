CREATE INDEX "setup_detections_user_id_idx" ON "setup_detections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "setup_detections_symbol_interval_idx" ON "setup_detections" USING btree ("symbol","interval");--> statement-breakpoint
CREATE INDEX "setup_detections_setup_type_idx" ON "setup_detections" USING btree ("setup_type");--> statement-breakpoint
CREATE INDEX "setup_detections_detected_at_idx" ON "setup_detections" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "setup_detections_expires_at_idx" ON "setup_detections" USING btree ("expires_at");