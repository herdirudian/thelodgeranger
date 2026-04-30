CREATE TABLE `VotingCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `group` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `targetType` ENUM('USER', 'DEPARTMENT') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VotingCategory_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Vote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoryId` INTEGER NOT NULL,
    `voterId` INTEGER NOT NULL,
    `candidateUserId` INTEGER NULL,
    `candidateDepartment` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Vote_categoryId_voterId_key`(`categoryId`, `voterId`),
    INDEX `Vote_candidateUserId_idx`(`candidateUserId`),
    INDEX `Vote_candidateDepartment_idx`(`candidateDepartment`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Vote` ADD CONSTRAINT `Vote_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `VotingCategory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Vote` ADD CONSTRAINT `Vote_voterId_fkey` FOREIGN KEY (`voterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Vote` ADD CONSTRAINT `Vote_candidateUserId_fkey` FOREIGN KEY (`candidateUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
