CREATE TABLE `ocr_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT '未命名识别',
	`imageUrl` text NOT NULL,
	`imageKey` varchar(512) NOT NULL,
	`originalFilename` varchar(255),
	`tableData` text NOT NULL,
	`status` enum('pending','processing','done','error') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ocr_records_id` PRIMARY KEY(`id`)
);
