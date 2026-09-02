"use client";

import RestaurantSurveyForm from "@/components/RestaurantSurveyForm";

export default function CaveSurveyPage() {
  return (
    <RestaurantSurveyForm
      title="GUEST COMMENT THE CAVE"
      subtitle="Guest Comment • The Cave Cafe"
      surveyType="THE_CAVE"
      thankYouMessage="Terima kasih atas saran dan kritik Anda untuk The Cave Cafe."
    />
  );
}
