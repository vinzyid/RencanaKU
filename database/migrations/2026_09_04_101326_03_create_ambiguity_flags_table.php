<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('ambiguity_flags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prd_version_id')->constrained()->cascadeOnDelete();
            $table->text('question');
            $table->boolean('is_resolved')->default(false);
            $table->text('resolution_answer')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ambiguity_flags');
    }
};
