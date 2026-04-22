-- CreateIndex
CREATE UNIQUE INDEX "ExpectancySnapshot_restaurantId_entityType_entityId_key" ON "ExpectancySnapshot"("restaurantId", "entityType", "entityId");
